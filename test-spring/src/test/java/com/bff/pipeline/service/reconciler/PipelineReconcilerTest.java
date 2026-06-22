package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.client.FakeImClient;
import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import com.bff.pipeline.service.external.ExternalCallLauncher;
import com.bff.pipeline.service.external.TaskCheckObservationWriter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The {@link PipelineReconciler} orchestration: the leader gate, the global due-order budget consumption (SCOPE §3 /
 * D-T7), and end-to-end tick transitions + derivation. Same NOT_SUPPORTED + cleanup harness as the rest of
 * the reconciler suite (each advance/derive commits in its own tx). The external call seam is a settable fake
 * {@link com.bff.pipeline.client.ImClient}.
 */
@DataJpaTest
@Import({
        PipelineReconciler.class,
        PipelineTaskAdvancer.class,
        PipelineStatusDeriver.class,
        TaskCheckRetentionPruner.class,
        ExternalCallLauncher.class,
        TaskCheckObservationWriter.class,
        PipelineEventRecorder.class,
        PipelineReconcilerTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PipelineReconcilerTest {

    private static final Instant NOW = Instant.parse("2026-06-21T10:15:30Z");
    private static final String TF_OP = "apply-network";

    @Autowired private PipelineReconciler reconciler;
    @Autowired private PipelineRepository pipelines;
    @Autowired private PipelineEventRepository events;
    @Autowired private TaskRepository tasks;
    @Autowired private TaskAttemptRepository attempts;
    @Autowired private TaskCheckRepository checks;
    @Autowired private ManualCallExecutor callExecutor;
    @Autowired private FakeImClient im;
    @Autowired private FakeLeader leader;

    @AfterEach
    void cleanup() {
        leader.isLeader = true;
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        callExecutor.drain(); // discard any un-drained queued call so it cannot leak into the next test
        events.deleteAll();
        checks.deleteAll();
        attempts.deleteAll();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    @Test
    void tickServicesTheLongestOverdueTaskFirstUnderBudgetPressure() {
        // Two active pipelines, each one RUNNING TF task due for a poll; the budget is 1 (Wiring).
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        Task older = seedRunningTask(NOW.minus(Duration.ofSeconds(60))); // more overdue → serviced first
        Task newer = seedRunningTask(NOW.minus(Duration.ofSeconds(10)));

        reconciler.tick();    // fires the older task's poll (queued); the newer is starved by the budget
        callExecutor.drain(); // call thread writes the older task's observation

        assertThat(checks.findByTaskIdOrderByStartedAtAsc(older.getId())).isNotEmpty();
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(newer.getId())).isEmpty(); // starved by the budget
    }

    @Test
    void tickPromotesTheBlockedFirstTaskAndEmitsAnEvent() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), TaskStatus.BLOCKED, null);

        reconciler.tick();

        assertThat(tasks.findById(task.getId()).orElseThrow().getStatus()).isEqualTo(TaskStatus.READY);
        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(pipeline.getId())).isNotEmpty();
    }

    @Test
    void tickDerivesPipelineDoneWhenEveryTaskIsDone() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTask(pipeline.getId(), TaskStatus.DONE, null);

        reconciler.tick();

        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    @Test
    void tickDoesNothingWhenNotLeader() {
        leader.isLeader = false;
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), TaskStatus.BLOCKED, null);

        reconciler.tick();

        assertThat(tasks.findById(task.getId()).orElseThrow().getStatus()).isEqualTo(TaskStatus.BLOCKED);
    }

    private Task seedRunningTask(Instant nextCheckAt) {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), TaskStatus.RUNNING, nextCheckAt);
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(task.getId());
        attempt.setAttemptNo(1);
        attempt.setResponse("job-9");
        attempt.setStartedAt(NOW);
        attempts.save(attempt);
        return task;
    }

    private Pipeline seedPipeline(PipelineStatus status) {
        Pipeline p = new Pipeline();
        p.setTargetSourceId("ts-" + System.nanoTime());
        p.setType(PipelineType.INSTALL);
        p.setProvider("AWS");
        p.setStatus(status);
        p.setTriggeredBy(Actor.HUMAN);
        p.setCreatedAt(NOW);
        p.setStartedAt(NOW);
        p.setLastActivityAt(NOW);
        return pipelines.save(p);
    }

    private Task seedTask(Long pipelineId, TaskStatus status, Instant nextCheckAt) {
        Task t = new Task();
        t.setPipelineId(pipelineId);
        t.setSeq(0);
        t.setName("apply");
        t.setOperation(TF_OP);
        t.setKind(TaskKind.TERRAFORM_JOB);
        t.setStatus(status);
        t.setFailCount(0);
        t.setMaxFailCount(3);
        t.setNextCheckAt(nextCheckAt);
        return tasks.save(t);
    }

    @TestConfiguration
    static class Wiring {
        @Bean Clock clock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }

        @Bean PipelineEngineSettings pipelineEngineSettings() {
            return PipelineEngineSettings.builder()
                    .maxExternalCallsPerTick(1) // budget pressure for the due-order test
                    .build();
        }

        @Bean FakeLeader leader() {
            return new FakeLeader();
        }

        /** The fire-and-forget pool ({@link ExternalCallLauncher} @Qualifier): queue the call so it runs AFTER the
         *  firing tick commits (drained by the test), modelling production's async boundary. */
        @Bean Executor pipelineCallExecutor() {
            return new ManualCallExecutor();
        }

        @Bean FakeImClient fakeImClient() {
            return new FakeImClient();
        }
    }

    /**
     * Models the fire-and-forget pool ({@code pipelineCallExecutor}): a fired external call is QUEUED, not run
     * inline. {@link #drain()} runs every queued call — the call thread running AFTER the firing tick has
     * committed (so the observation's REQUIRES_NEW write commits cleanly).
     */
    static final class ManualCallExecutor implements Executor {
        private final Deque<Runnable> queued = new ArrayDeque<>();

        @Override
        public void execute(Runnable command) {
            queued.add(command);
        }

        /** run every queued external call — the call thread running AFTER the tick commits. */
        int drain() {
            int n = 0;
            while (!queued.isEmpty()) {
                queued.poll().run();
                n++;
            }
            return n;
        }
    }

    static final class FakeLeader extends ReconcileLeader {
        boolean isLeader = true;

        @Override public boolean isLeader() {
            return isLeader;
        }
    }
}
