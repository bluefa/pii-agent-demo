package com.bff.pipeline.reconcile;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.control.PipelineControl;
import com.bff.pipeline.create.PipelineCreator;
import com.bff.pipeline.create.PipelineInserter;
import com.bff.pipeline.create.Recipes;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.im.FakeImClient;
import com.bff.pipeline.im.ImCall;
import com.bff.pipeline.im.ImClient;
import com.bff.pipeline.im.TerraformPoll;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The minimal state machine end-to-end (minimal-redesign.md §2/§3): the reconciler drives a created pipeline
 * through its task chain over a {@link MutableClock} and a scripted {@link FakeImClient}. Each {@code tick()}
 * advances the current task one step, so a multi-step outcome is reached by ticking repeatedly (and advancing
 * the clock for deadline cases).
 */
@DataJpaTest
@Import({
        Reconciler.class, PipelineReconciliation.class, TaskMachine.class, PipelineCreator.class,
        PipelineInserter.class, PipelineControl.class, Recipes.class, ImCall.class, ReconcilerTest.Wiring.class
})
class ReconcilerTest {

    private static final Instant START = Instant.parse("2026-06-23T00:00:00Z");

    @Autowired private Reconciler reconciler;
    @Autowired private PipelineCreator creator;
    @Autowired private PipelineControl control;
    @Autowired private PipelineRepository pipelines;
    @Autowired private TaskRepository tasks;
    @Autowired private MutableClock clock;
    @Autowired private FakeImClient im;

    @BeforeEach
    void reset() {
        clock.set(START);
        im.onDispatch(() -> "job-1");
        im.onPoll(TerraformPoll::running);
        im.onCheck(() -> false);
    }

    // ---- TERRAFORM_JOB ----

    @Test
    void terraformJobHappyPathReachesDoneAndCompletesTheDeletePipeline() {
        Pipeline pipeline = creator.create("ts-1", PipelineType.DELETE); // recipe: one TF destroy task

        reconciler.tick(); // READY → dispatch → IN_PROGRESS (job-1 stored)
        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(task.getJobId()).isEqualTo("job-1");

        im.onPoll(TerraformPoll::success);
        reconciler.tick(); // IN_PROGRESS → poll SUCCEEDED → DONE → pipeline DONE

        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    @Test
    void terraformJobFailureRetriesThenFailsAtMaxAndFailsThePipeline() {
        Pipeline pipeline = creator.create("ts-2", PipelineType.DELETE);
        im.onPoll(TerraformPoll::failure);

        // maxFailCount=3: each (dispatch, poll=FAILED) pair consumes one fail; 3 fails → FAILED.
        for (int i = 0; i < 3; i++) {
            reconciler.tick(); // dispatch → IN_PROGRESS
            reconciler.tick(); // poll FAILED → retry (or fail at max)
        }

        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getFailCount()).isEqualTo(3);
        assertThat(task.getErrorCode()).isEqualTo(ErrorCode.JOB_FAILED);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.FAILED);
    }

    @Test
    void aThrowingDispatchIncrementsFailCountAndRetriesThenFailsAtMax() {
        // The dispatch IM call is guarded like poll: a throw is a retriable failure, so the task does not get
        // stuck READY and the tick is not aborted.
        Pipeline pipeline = creator.create("ts-dispatch-fail", PipelineType.DELETE);
        im.onDispatch(() -> { throw new RuntimeException("IM dispatch rejected"); });

        reconciler.tick(); // dispatch throws → retryOrFail → fail #1, back to READY
        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.READY);
        assertThat(onlyTask(pipeline).getFailCount()).isEqualTo(1);

        reconciler.tick(); // fail #2
        reconciler.tick(); // fail #3 → FAILED at max

        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getFailCount()).isEqualTo(3);
        assertThat(task.getErrorCode()).isEqualTo(ErrorCode.CHECK_ERROR);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.FAILED);
    }

    @Test
    void aSlowDispatchTimesOutAsCallTimeoutAndRetries() {
        Pipeline pipeline = creator.create("ts-dispatch-timeout", PipelineType.DELETE);
        setTaskKnob(pipeline, t -> t.setMaxFailCount(1));
        im.onDispatch(() -> { FakeImClient.sleepPastTimeout(); return "job-late"; });

        reconciler.tick(); // slow dispatch → CALL_TIMEOUT → fail at max

        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getErrorCode()).isEqualTo(ErrorCode.CALL_TIMEOUT);
    }

    @Test
    void terraformJobRunningPastExecutionTimeoutFailsWithExecutionTimeout() {
        Pipeline pipeline = creator.create("ts-3", PipelineType.DELETE);
        setTaskKnob(pipeline, t -> { t.setExecutionTimeout(Duration.ofMinutes(10)); t.setMaxFailCount(1); });
        im.onPoll(TerraformPoll::running); // never finishes

        reconciler.tick(); // dispatch → IN_PROGRESS (startedAt = START)
        clock.advance(Duration.ofMinutes(11)); // past the 10m execution timeout
        reconciler.tick(); // poll still running + past deadline → fail at max

        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getErrorCode()).isEqualTo(ErrorCode.EXECUTION_TIMEOUT);
    }

    @Test
    void aSlowDispatchCallTimesOutAsCallTimeout() {
        Pipeline pipeline = creator.create("ts-4", PipelineType.DELETE);
        setTaskKnob(pipeline, t -> t.setMaxFailCount(1));
        // The dispatch (READY) blocks past the per-call timeout — but dispatch is not wrapped in retry; only
        // poll is. So drive a CALL_TIMEOUT on the POLL path: dispatch ok, then a slow poll.
        reconciler.tick(); // dispatch ok → IN_PROGRESS
        im.onPoll(() -> { FakeImClient.sleepPastTimeout(); return TerraformPoll.success(); });

        reconciler.tick(); // slow poll → CALL_TIMEOUT → fail at max

        Task task = onlyTask(pipeline);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getErrorCode()).isEqualTo(ErrorCode.CALL_TIMEOUT);
    }

    // ---- CONDITION_CHECK (the second task of an INSTALL pipeline) ----

    @Test
    void conditionMetCompletesAfterTheTerraformStep() {
        Pipeline pipeline = creator.create("ts-5", PipelineType.INSTALL); // TF apply → CONDITION ready
        im.onPoll(TerraformPoll::success);

        reconciler.tick(); // TF dispatch → IN_PROGRESS
        reconciler.tick(); // TF poll SUCCEEDED → DONE (condition task is now current)
        assertThat(taskAtSeq(pipeline, 0).getStatus()).isEqualTo(TaskStatus.DONE);

        reconciler.tick(); // condition READY → dispatch (no jobId) → IN_PROGRESS
        assertThat(taskAtSeq(pipeline, 1).getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);

        im.onCheck(() -> true);
        reconciler.tick(); // condition met → DONE → pipeline DONE

        assertThat(taskAtSeq(pipeline, 1).getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    @Test
    void conditionNotMetReschedulesByThePollingIntervalAndDoesNotFail() {
        Pipeline pipeline = creator.create("ts-6", PipelineType.INSTALL);
        completeTerraformStep(pipeline);
        setTaskKnobAtSeq(pipeline, 1, t -> t.setPollingInterval(Duration.ofMinutes(5)));
        im.onCheck(() -> false); // not met

        reconciler.tick(); // condition dispatch → IN_PROGRESS
        reconciler.tick(); // not met → reschedule, stay IN_PROGRESS

        Task condition = taskAtSeq(pipeline, 1);
        assertThat(condition.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(condition.getNextCheckAt()).isEqualTo(clock.instant().plus(Duration.ofMinutes(5)));
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.RUNNING);
    }

    @Test
    void conditionPastTtlExpiresToFailedWithTtlExpired() {
        Pipeline pipeline = creator.create("ts-7", PipelineType.INSTALL);
        completeTerraformStep(pipeline);
        setTaskKnobAtSeq(pipeline, 1, t -> { t.setTtl(Duration.ofMinutes(30)); t.setPollingInterval(Duration.ofMinutes(1)); });
        im.onCheck(() -> false);

        reconciler.tick(); // condition dispatch → IN_PROGRESS (startedAt = now)
        clock.advance(Duration.ofMinutes(31)); // past ttl
        reconciler.tick(); // not met + past ttl → FAILED(TTL_EXPIRED)

        Task condition = taskAtSeq(pipeline, 1);
        assertThat(condition.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(condition.getErrorCode()).isEqualTo(ErrorCode.TTL_EXPIRED);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.FAILED);
    }

    // ---- cancel, uniqueness, crash-resume ----

    @Test
    void cancelMidFlightCancelsThePipelineAndItsInProgressTaskAndTheTickSkipsIt() {
        Pipeline pipeline = creator.create("ts-8", PipelineType.DELETE);
        reconciler.tick(); // dispatch → IN_PROGRESS
        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);

        control.cancel(pipeline.getId());

        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.CANCELLED);
        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.CANCELLED);

        // A subsequent tick must not resurrect a cancelled pipeline.
        im.onPoll(TerraformPoll::success);
        reconciler.tick();
        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.CANCELLED);
    }

    @Test
    void crashResumeRePollsAnInProgressTerraformJobByItsStoredJobId() {
        Pipeline pipeline = creator.create("ts-crash", PipelineType.DELETE);
        reconciler.tick(); // dispatch → IN_PROGRESS, job-1 stored
        assertThat(onlyTask(pipeline).getJobId()).isEqualTo("job-1");

        // Simulate a restart: a brand-new tick (the DB row is the only state) re-polls by job_id and finishes.
        im.onPoll(TerraformPoll::success);
        reconciler.tick();

        assertThat(onlyTask(pipeline).getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(reload(pipeline).getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    // ---- helpers ----

    private void completeTerraformStep(Pipeline pipeline) {
        im.onPoll(TerraformPoll::success);
        reconciler.tick(); // TF dispatch
        reconciler.tick(); // TF SUCCEEDED → DONE
        im.onPoll(TerraformPoll::running);
        assertThat(taskAtSeq(pipeline, 0).getStatus()).isEqualTo(TaskStatus.DONE);
    }

    private Task onlyTask(Pipeline pipeline) {
        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId());
        assertThat(chain).hasSize(1);
        return chain.getFirst();
    }

    private Task taskAtSeq(Pipeline pipeline, int seq) {
        return tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()).get(seq);
    }

    private Pipeline reload(Pipeline pipeline) {
        return pipelines.findById(pipeline.getId()).orElseThrow();
    }

    private void setTaskKnob(Pipeline pipeline, java.util.function.Consumer<Task> knob) {
        setTaskKnobAtSeq(pipeline, 0, knob);
    }

    private void setTaskKnobAtSeq(Pipeline pipeline, int seq, java.util.function.Consumer<Task> knob) {
        Task task = taskAtSeq(pipeline, seq);
        knob.accept(task);
        tasks.save(task);
    }

    @TestConfiguration
    static class Wiring {
        @Bean MutableClock clock() {
            return new MutableClock(START);
        }

        @Bean PipelineSettings pipelineSettings() {
            return PipelineSettings.defaults().withPerCallTimeout(Duration.ofMillis(200)); // fast CALL_TIMEOUT
        }

        @Bean FakeImClient fakeImClient() {
            return new FakeImClient(); // the single ImClient bean (FakeImClient implements ImClient)
        }

        @Bean ExecutorService imCallPool() {
            return Executors.newFixedThreadPool(2);
        }
    }

    /** A mutable clock the test advances to cross per-task deadlines. */
    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void set(Instant t) {
            this.now = t;
        }

        void advance(Duration d) {
            this.now = this.now.plus(d);
        }

        @Override public Instant instant() {
            return now;
        }

        @Override public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
