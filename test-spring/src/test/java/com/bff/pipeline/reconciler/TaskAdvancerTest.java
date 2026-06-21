package com.bff.pipeline.reconciler;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskAttempt;
import com.bff.pipeline.domain.TaskCheck;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.handler.CheckContext;
import com.bff.pipeline.handler.CheckOutcome;
import com.bff.pipeline.handler.ConditionCheckHandler;
import com.bff.pipeline.handler.DispatchContext;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.handler.PollContext;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.bff.pipeline.service.CallOutcome;
import com.bff.pipeline.service.EventRecorder;
import com.bff.pipeline.service.ExternalCallExecutor;
import com.bff.pipeline.service.ExternalCalls;
import com.bff.pipeline.service.ObservationWriter;
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
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The reconciler state machine ({@link TaskAdvancer} + {@link PipelineDeriver}). Each advance is its own
 * REQUIRES-NEW-driven committed transaction, so the @DataJpaTest wrapper is suppressed (NOT_SUPPORTED) and
 * rows are seeded/asserted through the repos; {@link #cleanup()} clears the committed rows. The real
 * {@link ExternalCalls}/{@link ObservationWriter} run, driven by a fixed clock, a settable fake executor,
 * and settable fake handlers; time-based paths are triggered by seeding timestamps in the past.
 */
@DataJpaTest
@Import({
        TaskAdvancer.class,
        PipelineDeriver.class,
        TaskCheckPruner.class,
        ExternalCalls.class,
        ObservationWriter.class,
        EventRecorder.class,
        HandlerRegistry.class,
        TaskAdvancerTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TaskAdvancerTest {

    private static final Instant NOW = Instant.parse("2026-06-21T10:15:30Z");
    private static final String TARGET = "ts-tick-1";

    @Autowired private TaskAdvancer advancer;
    @Autowired private PipelineDeriver deriver;
    @Autowired private TaskCheckPruner pruner;
    @Autowired private PipelineRepository pipelines;
    @Autowired private PipelineEventRepository events;
    @Autowired private TaskRepository tasks;
    @Autowired private TaskAttemptRepository attempts;
    @Autowired private TaskCheckRepository checks;
    @Autowired private FakeExecutor executor;
    @Autowired private FakeTf tf;
    @Autowired private FakeCond cond;

    @AfterEach
    void cleanup() {
        executor.reset();
        events.deleteAll();
        checks.deleteAll();
        attempts.deleteAll();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    private TickBudget budget() {
        return new TickBudget(100);
    }

    // ---- forward ----

    @Test
    void blockedFirstTaskPromotesToReady() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.BLOCKED, FakeTf.KEY);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.READY);
    }

    @Test
    void blockedLaterTaskWaitsForItsPredecessor() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTaskStatus(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING);
        Task second = seedTask(pipeline.getId(), 1, TaskKind.CONDITION_CHECK, TaskStatus.BLOCKED, FakeCond.KEY);

        advancer.advance(pipeline, second, true, budget());
        assertThat(reload(second).getStatus()).isEqualTo(TaskStatus.BLOCKED);

        Task first = tasks.findByPipelineIdAndSeq(pipeline.getId(), 0).orElseThrow();
        first.setStatus(TaskStatus.DONE);
        tasks.save(first);

        advancer.advance(pipeline, reload(second), true, budget());
        assertThat(reload(second).getStatus()).isEqualTo(TaskStatus.READY);
    }

    @Test
    void readyTerraformAdmitsToDispatchingAndCreatesAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.READY, FakeTf.KEY);

        advancer.advance(pipeline, task, true, budget());

        Task after = reload(task);
        assertThat(after.getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(after.getDeadlineAt()).isNotNull();
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getAttemptNo()).isEqualTo(1);
    }

    @Test
    void readyTerraformStaysWhenSlotCapIsFull() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTaskStatus(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING); // occupies the only slot (slotCap=1)
        Task waiting = seedTask(pipeline.getId(), 1, TaskKind.TERRAFORM_JOB, TaskStatus.READY, FakeTf.KEY);

        advancer.advance(pipeline, waiting, true, budget());

        assertThat(reload(waiting).getStatus()).isEqualTo(TaskStatus.READY); // slot queue
    }

    @Test
    void readyConditionStartsWaitingExternalWithNoAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.READY, FakeCond.KEY);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.WAITING_EXTERNAL);
        assertThat(reload(task).getDeadlineAt()).isNotNull();
        assertThat(attempts.findByTaskIdOrderByAttemptNoAsc(task.getId())).isEmpty();
    }

    @Test
    void unknownHandlerFailsTaskWithSyntheticCheckAndNoFailCount() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL, "missing.handler");

        advancer.advance(pipeline, task, true, budget());

        Task after = reload(task);
        assertThat(after.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(after.getFailCount()).isZero();
        assertThat(checks.findFirstByTaskIdOrderByStartedAtDescIdDesc(task.getId())).get().satisfies(row -> {
            assertThat(row.getName()).isEqualTo("orchestrator.handler.resolve");
            assertThat(row.getErrorCode()).isEqualTo(ErrorCode.HANDLER_NOT_FOUND);
        });
    }

    // ---- dispatch / DISPATCHING ----

    @Test
    void dispatchingWithAdoptedResponsePromotesToRunning() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING);
    }

    @Test
    void dispatchingFiresDispatchAndAdoptsAcceptedResponse() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY);
        TaskAttempt attempt = seedAttempt(task.getId(), 1, null, NOW, null); // open, response null
        tf.dispatch = new DispatchOutcome.Accepted("job-42");

        advancer.advance(pipeline, task, true, budget());

        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isEqualTo("job-42");
        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING); // RUNNING happens next tick
    }

    @Test
    void dispatchRejectedUnderMaxFailsAttemptAndOpensANewOne() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY, 0, 3);
        TaskAttempt attempt = seedAttempt(task.getId(), 1, null, NOW, null);
        tf.dispatch = new DispatchOutcome.Rejected("nope");

        advancer.advance(pipeline, task, true, budget());

        assertThat(attempts.findById(attempt.getId()).orElseThrow().getErrorCode()).isEqualTo(ErrorCode.IM_REJECTED);
        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getAttemptNo()).isEqualTo(2);
    }

    @Test
    void dispatchRejectedAtMaxFailsTask() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY, 2, 3);
        seedAttempt(task.getId(), 3, null, NOW, null);
        tf.dispatch = new DispatchOutcome.Rejected("nope");

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(reload(task).getFailCount()).isEqualTo(3);
    }

    @Test
    void dispatchingPastRecoveryTimeoutFailsWithDispatchNoResponse() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY, 0, 3);
        // attempt started long before now; response still null → recovery closes it.
        seedAttempt(task.getId(), 1, null, NOW.minus(Duration.ofMinutes(10)), null);

        advancer.advance(pipeline, task, false, budget()); // not due: no re-fire; recovery is time-based

        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId())).get().satisfies(a -> {
            // a new attempt (no_2) opened after the recovery failure of attempt 1
            assertThat(a.getAttemptNo()).isEqualTo(2);
        });
        assertThat(reload(task).getFailCount()).isEqualTo(1);
    }

    // ---- RUNNING ----

    @Test
    void runningPollSucceededCompletesTaskAndClosesAttemptOk() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY);
        TaskAttempt attempt = seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.SUCCEEDED);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResult().name()).isEqualTo("OK");
    }

    @Test
    void runningPollFailedRequeuesUnderMaxAndFailsAtMax() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task underMax = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY, 0, 3);
        seedAttempt(underMax.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.FAILED);
        advancer.advance(pipeline, underMax, true, budget());
        assertThat(reload(underMax).getStatus()).isEqualTo(TaskStatus.READY); // slot released, requeue
        assertThat(reload(underMax).getFailCount()).isEqualTo(1);

        Task atMax = seedTask(pipeline.getId(), 1, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY, 2, 3);
        seedAttempt(atMax.getId(), 3, "job-9", NOW, null);
        advancer.advance(pipeline, atMax, true, budget());
        assertThat(reload(atMax).getStatus()).isEqualTo(TaskStatus.FAILED);
    }

    @Test
    void runningPollReadErrorDoesNotConsumeFailCount() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY, 0, 3);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.CallFailed(ErrorCode.CHECK_ERROR);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(reload(task).getFailCount()).isZero(); // job not read ≠ job failed
    }

    @Test
    void runningExecutionTimeoutFailsAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY, 0, 3);
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1))); // already past
        tasks.save(task);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.RUNNING); // not terminal → timeout applies

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getErrorCode())
                .isEqualTo(ErrorCode.EXECUTION_TIMEOUT);
    }

    @Test
    void budgetExhaustedSkipsThePoll() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.SUCCEEDED);

        advancer.advance(pipeline, task, true, new TickBudget(0));

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING); // not polled
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).isEmpty();
    }

    // ---- WAITING_EXTERNAL ----

    @Test
    void waitingExternalMetCompletes() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL, FakeCond.KEY);
        cond.check = new CheckOutcome.Condition(Observed.MET);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE);
    }

    @Test
    void waitingExternalNotMetStaysWithoutFail() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL, FakeCond.KEY, 0, 3);
        cond.check = new CheckOutcome.Condition(Observed.NOT_MET);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.WAITING_EXTERNAL);
        assertThat(reload(task).getFailCount()).isZero();
    }

    @Test
    void waitingExternalCheckErrorAtMaxFails() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL, FakeCond.KEY, 2, 3);
        cond.check = new CheckOutcome.CallFailed(ErrorCode.CHECK_ERROR);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(reload(task).getFailCount()).isEqualTo(3);
    }

    @Test
    void waitingExternalTtlExpires() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL, FakeCond.KEY);
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1)));
        tasks.save(task);
        cond.check = new CheckOutcome.Condition(Observed.NOT_MET);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.EXPIRED);
    }

    // ---- cancel ----

    @Test
    void cancellingDispatchingTaskCancelsImmediatelyAndClosesAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY);
        TaskAttempt attempt = seedAttempt(task.getId(), 1, null, NOW, null);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.CANCELLED);
        TaskAttempt closed = attempts.findById(attempt.getId()).orElseThrow();
        assertThat(closed.getFinishedAt()).isNotNull();
        assertThat(closed.getErrorCode()).isNull(); // cancel cleanup has no reason code
    }

    @Test
    void cancellingRunningTaskDrainsToTerminal() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.SUCCEEDED);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE); // drained to its real terminal
    }

    // ---- pipeline derivation ----

    @Test
    void deriveCancellingWithAllTasksTerminalCancelsBeatsFailed() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        seedTaskStatus(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.FAILED);
        seedTaskStatus(pipeline.getId(), 1, TaskKind.CONDITION_CHECK, TaskStatus.CANCELLED);

        deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));

        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.CANCELLED);
    }

    @Test
    void deriveRunningWithAFailedTaskFailsPipelineWithReason() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task failed = seedTaskStatus(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.FAILED);
        TaskAttempt attempt = seedAttempt(failed.getId(), 1, "job-9", NOW, NOW);
        attempt.setErrorCode(ErrorCode.JOB_FAILED);
        attempts.save(attempt);

        deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));

        Pipeline after = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PipelineStatus.FAILED);
        assertThat(after.getFailReasonTaskId()).isEqualTo(failed.getId());
        assertThat(after.getFailReasonErrorCode()).isEqualTo(ErrorCode.JOB_FAILED);
    }

    @Test
    void deriveRunningWithAllTasksDoneCompletesPipeline() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTaskStatus(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DONE);
        seedTaskStatus(pipeline.getId(), 1, TaskKind.CONDITION_CHECK, TaskStatus.DONE);

        deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));

        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    // ---- prune ----

    @Test
    void pruneDeletesOnlyChecksPastRetention() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY);
        checks.save(check(task.getId(), NOW.minus(Duration.ofDays(120)))); // older than 90d retention
        checks.save(check(task.getId(), NOW.minus(Duration.ofDays(1))));

        int deleted = pruner.prune();

        assertThat(deleted).isEqualTo(1);
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).hasSize(1);
    }

    @Test
    void dispatchingBackpressureSuppressesTheRecoveryFail() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY, 0, 3);
        seedAttempt(task.getId(), 1, null, NOW.minus(Duration.ofMinutes(10)), null); // old enough to be recovery-due
        checks.save(dispatchObservation(task.getId(), ApiResult.ERROR, null)); // last DISPATCH obs = backpressure marker

        advancer.advance(pipeline, task, false, budget()); // not due: no re-fire; recovery must be suppressed

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(reload(task).getFailCount()).isZero(); // backpressure ⇒ no DISPATCH_NO_RESPONSE fail++
    }

    @Test
    void dispatchRejectedThenRedispatchesTheNewAttemptNextTick() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.DISPATCHING, FakeTf.KEY, 0, 3);
        seedAttempt(task.getId(), 1, null, NOW, null);
        tf.dispatch = new DispatchOutcome.Rejected("nope");
        advancer.advance(pipeline, task, true, budget()); // attempt 1 fails, attempt 2 opens

        tf.dispatch = new DispatchOutcome.Accepted("job-redispatch");
        advancer.advance(pipeline, reload(task), true, budget()); // NOT stalled by the prior (ERROR,null) row

        TaskAttempt latest = attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow();
        assertThat(latest.getAttemptNo()).isEqualTo(2);
        assertThat(latest.getResponse()).isEqualTo("job-redispatch");
    }

    @Test
    void runningPollSucceededBeatsAnExpiredExecutionDeadline() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY);
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1))); // execution deadline already passed
        tasks.save(task);
        seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.SUCCEEDED);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE); // completed observation beats timeout
    }

    @Test
    void cancellingRunningDrainFailedTerminatesAsFailedAndCounts() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING, FakeTf.KEY, 0, 3);
        TaskAttempt attempt = seedAttempt(task.getId(), 1, "job-9", NOW, null);
        tf.poll = new PollOutcome.Status(Observed.FAILED);

        advancer.advance(pipeline, task, true, budget());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED); // real failure recorded, no requeue
        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getErrorCode()).isEqualTo(ErrorCode.JOB_FAILED);
    }

    @Test
    void aTransitionEmitsAPipelineEvent() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(pipeline.getId(), 0, TaskKind.TERRAFORM_JOB, TaskStatus.BLOCKED, FakeTf.KEY);

        advancer.advance(pipeline, task, true, budget());

        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(pipeline.getId())).singleElement()
                .satisfies((PipelineEvent event) -> {
                    assertThat(event.getType()).isEqualTo("TASK:READY");
                    assertThat(event.getTaskId()).isEqualTo(task.getId());
                    assertThat(event.getActor()).isEqualTo(Actor.SYSTEM);
                });
    }

    // ---- seeds ----

    private Pipeline seedPipeline(PipelineStatus status) {
        Pipeline p = new Pipeline();
        p.setTargetSourceId(TARGET + "-" + status + "-" + System.identityHashCode(new Object()));
        p.setType(PipelineType.INSTALL);
        p.setProvider("AWS");
        p.setStatus(status);
        p.setTriggeredBy(Actor.HUMAN);
        p.setCreatedAt(NOW);
        p.setStartedAt(NOW);
        p.setLastActivityAt(NOW);
        return pipelines.save(p);
    }

    private Task seedTask(Long pipelineId, int seq, TaskKind kind, TaskStatus status, String handlerKey) {
        return seedTask(pipelineId, seq, kind, status, handlerKey, 0, 3);
    }

    private Task seedTask(Long pipelineId, int seq, TaskKind kind, TaskStatus status, String handlerKey, int failCount, int maxFailCount) {
        Task t = new Task();
        t.setPipelineId(pipelineId);
        t.setSeq(seq);
        t.setName("task-" + seq);
        t.setHandlerKey(handlerKey);
        t.setKind(kind);
        t.setStatus(status);
        t.setFailCount(failCount);
        t.setMaxFailCount(maxFailCount);
        return tasks.save(t);
    }

    private Task seedTaskStatus(Long pipelineId, int seq, TaskKind kind, TaskStatus status) {
        return seedTask(pipelineId, seq, kind, status, kind == TaskKind.TERRAFORM_JOB ? FakeTf.KEY : FakeCond.KEY);
    }

    private TaskAttempt seedAttempt(Long taskId, int attemptNo, String response, Instant startedAt, Instant finishedAt) {
        TaskAttempt a = new TaskAttempt();
        a.setTaskId(taskId);
        a.setAttemptNo(attemptNo);
        a.setResponse(response);
        a.setStartedAt(startedAt);
        a.setFinishedAt(finishedAt);
        return attempts.save(a);
    }

    private TaskCheck dispatchObservation(Long taskId, ApiResult apiResult, ErrorCode errorCode) {
        TaskCheck c = new TaskCheck();
        c.setTaskId(taskId);
        c.setKind(CheckKind.DISPATCH);
        c.setName("fake.tf:dispatch");
        c.setApiResult(apiResult);
        c.setErrorCode(errorCode);
        c.setPollCount(1);
        c.setStartedAt(NOW);
        c.setCheckedAt(NOW);
        return c;
    }

    private TaskCheck check(Long taskId, Instant checkedAt) {
        TaskCheck c = new TaskCheck();
        c.setTaskId(taskId);
        c.setKind(CheckKind.CHECK);
        c.setName("im:poll");
        c.setApiResult(ApiResult.OK);
        c.setObserved(Observed.RUNNING);
        c.setPollCount(1);
        c.setStartedAt(checkedAt);
        c.setCheckedAt(checkedAt);
        return c;
    }

    private Task reload(Task task) {
        return tasks.findById(task.getId()).orElseThrow();
    }

    @TestConfiguration
    static class Wiring {
        @Bean Clock clock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }

        @Bean PipelineSettings pipelineSettings() {
            PipelineSettings s = new PipelineSettings();
            s.setSlotCap(1); // one slot → deterministic admission tests
            return s;
        }

        @Bean Leader leader() {
            return () -> true;
        }

        @Bean FakeExecutor fakeExecutor() {
            return new FakeExecutor();
        }

        @Bean FakeTf fakeTf() {
            return new FakeTf();
        }

        @Bean FakeCond fakeCond() {
            return new FakeCond();
        }
    }

    static final class FakeExecutor implements ExternalCallExecutor {
        private boolean timedOut = false;

        void setTimedOut(boolean timedOut) {
            this.timedOut = timedOut;
        }

        void reset() {
            this.timedOut = false;
        }

        @Override
        public <T> CallOutcome<T> call(Supplier<T> work, Duration deadline) {
            return timedOut ? new CallOutcome<>(null, 1, true) : new CallOutcome<>(work.get(), 1, false);
        }
    }

    static final class FakeTf implements TerraformJobHandler {
        static final String KEY = "fake.tf";
        DispatchOutcome dispatch = new DispatchOutcome.Accepted("job-9");
        PollOutcome poll = new PollOutcome.Status(Observed.RUNNING);

        @Override public String key() { return KEY; }
        @Override public DispatchOutcome dispatch(DispatchContext ctx) { return dispatch; }
        @Override public PollOutcome poll(PollContext ctx) { return poll; }
    }

    static final class FakeCond implements ConditionCheckHandler {
        static final String KEY = "fake.cond";
        CheckOutcome check = new CheckOutcome.Condition(Observed.NOT_MET);

        @Override public String key() { return KEY; }
        @Override public CheckOutcome check(CheckContext ctx) { return check; }
    }
}
