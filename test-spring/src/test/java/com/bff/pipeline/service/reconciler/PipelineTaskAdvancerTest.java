package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.client.FakeImClient;
import com.bff.pipeline.client.ImClient;
import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineEventType;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import com.bff.pipeline.service.external.ExternalCallLauncher;
import com.bff.pipeline.service.external.TaskCheckObservationWriter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The reconciler state machine ({@link PipelineTaskAdvancer} + {@link PipelineStatusDeriver}). Each advance is its own
 * REQUIRES-NEW-driven committed transaction, so the @DataJpaTest wrapper is suppressed (NOT_SUPPORTED) and
 * rows are seeded/asserted through the repos; {@link #cleanup()} clears the committed rows. The real
 * {@link ExternalCallLauncher}/{@link TaskCheckObservationWriter} run, driven by a mutable clock, a settable fake executor,
 * and a settable fake {@link ImClient} (the test seam); time-based paths are triggered by seeding timestamps
 * in the past.
 *
 * <p>External calls are fire-and-forget (D-T2): {@link PipelineTaskAdvancer} FIRES a dispatch/poll/check at the END of
 * {@code advance()} via the {@code pipelineCallExecutor} and returns; the call's committed observation is read
 * to drive a transition on a LATER tick. The test models the call thread with a {@link ManualCallExecutor}
 * that QUEUES the fired call so it runs AFTER the firing tick commits (drained with {@code callExecutor.drain()}).
 * So a call-driven transition takes two advances: tick 1 fires the call, {@code drain()} writes the committed
 * observation, then tick 2 reads it and transitions. The clock {@link MutableClock} advances between ticks so
 * each attempt/observation gets a strictly-monotonic timestamp (as production's wall clock does) — the current
 * attempt's observation scoping stays correct across re-attempts.
 */
@DataJpaTest
@Import({
        PipelineTaskAdvancer.class,
        PipelineStatusDeriver.class,
        TaskCheckRetentionPruner.class,
        ExternalCallLauncher.class,
        TaskCheckObservationWriter.class,
        PipelineEventRecorder.class,
        PipelineTaskAdvancerTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PipelineTaskAdvancerTest {

    private static final Instant NOW = Instant.parse("2026-06-21T10:15:30Z");
    private static final Duration STEP = Duration.ofSeconds(1);
    private static final String TARGET = "ts-tick-1";
    private static final String TF_OP = "apply-network";
    private static final String COND_OP = "network-ready";

    @Autowired private PipelineTaskAdvancer advancer;
    @Autowired private PipelineStatusDeriver deriver;
    @Autowired private TaskCheckRetentionPruner pruner;
    @Autowired private PipelineRepository pipelines;
    @Autowired private PipelineEventRepository events;
    @Autowired private TaskRepository tasks;
    @Autowired private TaskAttemptRepository attempts;
    @Autowired private TaskCheckRepository checks;
    @Autowired private ManualCallExecutor callExecutor;
    @Autowired private MutableClock clock;
    @Autowired private FakeImClient im;

    @BeforeEach
    void resetClock() {
        clock.set(NOW);
        im.dispatchAccepted("job-9");
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        im.setCheckCondition(FakeImClient.condition(false));
    }

    @AfterEach
    void cleanup() {
        callExecutor.drain(); // discard any un-drained queued call so it cannot leak into the next test
        events.deleteAll();
        checks.deleteAll();
        attempts.deleteAll();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    private ExternalCallTickBudget budget() {
        return new ExternalCallTickBudget(100);
    }

    // ---- forward ----

    @Test
    void blockedFirstTaskPromotesToReady() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.BLOCKED).operation(TF_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.READY);
    }

    @Test
    void blockedLaterTaskWaitsForItsPredecessor() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        Task second = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.BLOCKED).operation(COND_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(second).due(true).budget(budget()).build());
        assertThat(reload(second).getStatus()).isEqualTo(TaskStatus.BLOCKED);

        Task first = tasks.findByPipelineIdAndSeq(pipeline.getId(), 0).orElseThrow();
        first.setStatus(TaskStatus.DONE);
        tasks.save(first);

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(second)).due(true).budget(budget()).build());
        assertThat(reload(second).getStatus()).isEqualTo(TaskStatus.READY);
    }

    @Test
    void readyTerraformAdmitsToDispatchingAndCreatesAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.READY).operation(TF_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        Task after = reload(task);
        assertThat(after.getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(after.getDeadlineAt()).isNotNull();
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getAttemptNo()).isEqualTo(1);
    }

    @Test
    void readyTerraformStaysWhenSlotCapIsFull() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build()); // occupies the only slot (slotCap=1)
        Task waiting = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.READY).operation(TF_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(waiting).due(true).budget(budget()).build());

        assertThat(reload(waiting).getStatus()).isEqualTo(TaskStatus.READY); // slot queue
    }

    @Test
    void readyConditionStartsWaitingExternalWithNoAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.READY).operation(COND_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.WAITING_EXTERNAL);
        assertThat(reload(task).getDeadlineAt()).isNotNull();
        assertThat(attempts.findByTaskIdOrderByAttemptNoAsc(task.getId())).isEmpty();
    }

    @Test
    void readyConditionRoutesByKindAndOperationNotAttempt() {
        // (kind, operation) routing replaces the handler registry: a CONDITION_CHECK task enters WAITING_EXTERNAL
        // (no attempt, no slot) purely from its kind — the operation string is what the launcher will call.
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task condition = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.READY).operation(COND_OP).build());
        Task terraform = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.READY).operation(TF_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(condition).due(true).budget(budget()).build());
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(terraform).due(true).budget(budget()).build());

        assertThat(reload(condition).getStatus()).isEqualTo(TaskStatus.WAITING_EXTERNAL); // no attempt
        assertThat(attempts.findByTaskIdOrderByAttemptNoAsc(condition.getId())).isEmpty();
        assertThat(reload(terraform).getStatus()).isEqualTo(TaskStatus.DISPATCHING);       // attempt created
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(terraform.getId())).isPresent();
    }

    // ---- dispatch / DISPATCHING ----

    @Test
    void dispatchingWithAdoptedResponsePromotesToRunning() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING);
    }

    @Test
    void dispatchingFiresDispatchAndAdoptsAcceptedResponse() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW).build()); // open, response null
        im.dispatchAccepted("job-42");

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick fires the dispatch (queued)
        callExecutor.drain();                             // call thread adopts the response, writes the OK row

        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isEqualTo("job-42");
        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING); // RUNNING happens next tick
    }

    @Test
    void dispatchRejectedUnderMaxFailsAttemptAndOpensANewOne() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW).build());
        im.setRunTerraform(FakeImClient.reject());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires dispatch (queued)
        callExecutor.drain();                             // call thread writes the (ERROR, IM_REJECTED) row
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads the reject → fails attempt, opens no_2

        assertThat(attempts.findById(attempt.getId()).orElseThrow().getErrorCode()).isEqualTo(ErrorCode.IM_REJECTED);
        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getAttemptNo()).isEqualTo(2);
    }

    @Test
    void dispatchRejectedAtMaxFailsTask() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(2).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(3).startedAt(NOW).build());
        im.setRunTerraform(FakeImClient.reject());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires dispatch (queued)
        callExecutor.drain();                             // call thread writes the (ERROR, IM_REJECTED) row
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads the reject → FAILED at max

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(reload(task).getFailCount()).isEqualTo(3);
    }

    @Test
    void dispatchingPastRecoveryTimeoutFailsWithDispatchNoResponse() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        // attempt started long before now; response still null → recovery closes it.
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW.minus(Duration.ofMinutes(10))).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(false).budget(budget()).build()); // not due: no re-fire; recovery is time-based

        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId())).get().satisfies(a -> {
            // a new attempt (no_2) opened after the recovery failure of attempt 1
            assertThat(a.getAttemptNo()).isEqualTo(2);
        });
        assertThat(reload(task).getFailCount()).isEqualTo(1);
    }

    @Test
    void enteringRunningClearsTheDispatchParkSoTheFirstPollIsDuePromptly() {
        // Regression: an accepted dispatch parks next_check_at at recoveryTimeout (so an in-flight dispatch is
        // not re-fired). The DISPATCHING→RUNNING transition MUST reset that, or the first job poll waits
        // ~recoveryTimeout (≈5 min) instead of the 30–60s job-poll cadence.
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build()); // response adopted → promotes to RUNNING this tick
        task.setNextCheckAt(NOW.plus(Duration.ofMinutes(5))); // the dispatch in-flight park
        tasks.save(task);

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        Task after = reload(task);
        assertThat(after.getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(after.getNextCheckAt()).isEqualTo(NOW); // reset to due-now (PipelineReconciler fires the poll next tick), not the 5-min park
    }

    // ---- RUNNING ----

    @Test
    void runningPollSucceededCompletesTaskAndClosesAttemptOk() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires poll (queued)
        callExecutor.drain();                             // call thread writes the SUCCEEDED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads SUCCEEDED → DONE

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResult().name()).isEqualTo("OK");
    }

    @Test
    void runningPollFailedRequeuesUnderMaxAndFailsAtMax() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task underMax = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(underMax.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("FAILED"));
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(underMax).due(true).budget(budget()).build()); // tick 1: fires poll (queued)
        callExecutor.drain();                                 // call thread writes the FAILED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(underMax)).due(true).budget(budget()).build()); // tick 2: reads FAILED → requeue
        assertThat(reload(underMax).getStatus()).isEqualTo(TaskStatus.READY); // slot released, requeue
        assertThat(reload(underMax).getFailCount()).isEqualTo(1);

        Task atMax = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).failCount(2).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(atMax.getId()).attemptNo(3).response("job-9").startedAt(NOW).build());
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(atMax).due(true).budget(budget()).build()); // tick 1: fires poll (queued)
        callExecutor.drain();                              // call thread writes the FAILED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(atMax)).due(true).budget(budget()).build()); // tick 2: reads FAILED → FAILED at max
        assertThat(reload(atMax).getStatus()).isEqualTo(TaskStatus.FAILED);
    }

    @Test
    void runningPollReadErrorDoesNotConsumeFailCount() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.reject()); // a read error (CHECK_ERROR) — not a job failure

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires poll (queued)
        callExecutor.drain();                             // call thread writes the (ERROR, CHECK_ERROR) read-error obs
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads the read-error → still RUNNING, no fail

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(reload(task).getFailCount()).isZero(); // job not read ≠ job failed
    }

    @Test
    void runningExecutionTimeoutFailsAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1))); // already past
        tasks.save(task);
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING")); // not terminal → timeout applies after a confirming poll

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires the confirming poll (checkedAt = now ≥ deadline)
        callExecutor.drain();                             // call thread writes the non-terminal RUNNING observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: poll-past-deadline still non-terminal → timeout

        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow().getErrorCode())
                .isEqualTo(ErrorCode.EXECUTION_TIMEOUT);
    }

    @Test
    void budgetExhaustedSkipsThePoll() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(new ExternalCallTickBudget(0)).build());
        callExecutor.drain(); // nothing was queued (budget starved the fire)

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING); // not polled
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).isEmpty();
    }

    // ---- WAITING_EXTERNAL ----

    @Test
    void waitingExternalMetCompletes() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).operation(COND_OP).build());
        im.setCheckCondition(FakeImClient.condition(true));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires check (queued)
        callExecutor.drain();                             // call thread writes the MET observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads MET → DONE

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE);
    }

    @Test
    void waitingExternalNotMetStaysWithoutFail() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).operation(COND_OP).failCount(0).maxFailCount(3).build());
        im.setCheckCondition(FakeImClient.condition(false));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires check (queued)
        callExecutor.drain();                             // call thread writes the NOT_MET observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: NOT_MET is not a failure → stays WAITING

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.WAITING_EXTERNAL);
        assertThat(reload(task).getFailCount()).isZero();
    }

    @Test
    void waitingExternalCheckErrorAtMaxFails() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).operation(COND_OP).failCount(0).maxFailCount(3).build());
        checks.save(conditionCheckError(task.getId(), 2)); // two prior failed CHECK calls in the durable ledger
        im.setCheckCondition(FakeImClient.reject()); // the 3rd check is a CHECK_ERROR

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires the 3rd check (queued)
        callExecutor.drain();                             // call thread folds the 3rd CHECK_ERROR into the ledger
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: recompute = 3 → maxFailCount → FAILED

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(reload(task).getFailCount()).isEqualTo(3);
    }

    @Test
    void conditionFailuresRecomputedFromLedgerFailEvenIfAFailWasNeverPersisted() {
        // codex's rollback scenario: failed CHECK calls committed to the ledger, but the fail++ tick rolled
        // back so fail_count is stale at 0. The recompute must terminalize FAILED — a later MET must not rescue it.
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).operation(COND_OP).failCount(0).maxFailCount(3).build());
        checks.save(conditionCheckError(task.getId(), 3)); // ledger already at max BEFORE this tick
        im.setCheckCondition(FakeImClient.condition(true));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // ledger recompute fires first → FAILED on this tick

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(reload(task).getFailCount()).isEqualTo(3);
    }

    @Test
    void waitingExternalTtlExpires() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).operation(COND_OP).build());
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1)));
        tasks.save(task);
        im.setCheckCondition(FakeImClient.condition(false));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires the confirming check (checkedAt = now ≥ TTL)
        callExecutor.drain();                             // call thread writes the non-MET observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: check-past-TTL still non-MET → EXPIRED

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.EXPIRED);
    }

    // ---- cancel ----

    @Test
    void cancellingDispatchingTaskCancelsImmediatelyAndClosesAttempt() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.CANCELLED);
        TaskAttempt closed = attempts.findById(attempt.getId()).orElseThrow();
        assertThat(closed.getFinishedAt()).isNotNull();
        assertThat(closed.getErrorCode()).isNull(); // cancel cleanup has no reason code
    }

    @Test
    void cancellingRunningTaskDrainsToTerminal() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: drain fires the poll (queued)
        callExecutor.drain();                             // call thread writes the SUCCEEDED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads SUCCEEDED → DONE

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE); // drained to its real terminal
    }

    @Test
    void cancellingDrainDefersTimeoutWhenBudgetIsExhausted() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1))); // deadline passed
        tasks.save(task);
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED")); // would succeed if it could be polled

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(new ExternalCallTickBudget(0)).build()); // no budget → defer, do not timeout blind
        callExecutor.drain(); // nothing queued

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.RUNNING);
    }

    // ---- pipeline derivation ----

    @Test
    void deriveCancellingWithAllTasksTerminalCancelsBeatsFailed() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.FAILED).operation(TF_OP).build());
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.CANCELLED).operation(COND_OP).build());

        deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));

        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.CANCELLED);
    }

    @Test
    void deriveRunningWithAFailedTaskFailsPipelineWithReason() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task failed = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.FAILED).operation(TF_OP).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(failed.getId()).attemptNo(1).response("job-9").startedAt(NOW).finishedAt(NOW).build());
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
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DONE).operation(TF_OP).build());
        seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).kind(TaskKind.CONDITION_CHECK).status(TaskStatus.DONE).operation(COND_OP).build());

        deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));

        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    // ---- prune ----

    @Test
    void pruneDeletesOnlyChecksPastRetention() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        checks.save(check(task.getId(), NOW.minus(Duration.ofDays(120)))); // older than 90d retention
        checks.save(check(task.getId(), NOW.minus(Duration.ofDays(1))));

        int deleted = pruner.prune();

        assertThat(deleted).isEqualTo(1);
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).hasSize(1);
    }

    @Test
    void dispatchingBackpressureSuppressesTheRecoveryFail() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW.minus(Duration.ofMinutes(10))).build()); // recovery-due
        checks.save(dispatchObservation(DispatchObservationSeed.builder()
                .taskId(task.getId()).attemptId(attempt.getId()).apiResult(ApiResult.ERROR).build())); // this attempt's last DISPATCH = backpressure marker

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(false).budget(budget()).build()); // not due: no re-fire; recovery must be suppressed

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(reload(task).getFailCount()).isZero(); // backpressure ⇒ no DISPATCH_NO_RESPONSE fail++
    }

    @Test
    void dispatchRejectedThenRedispatchesTheNewAttemptNextTick() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW).build());
        im.setRunTerraform(FakeImClient.reject());
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires the reject (queued)
        callExecutor.drain();                             // call thread writes attempt 1's (ERROR, IM_REJECTED) row

        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads reject → attempt 1 fails, attempt 2 opens (later startedAt)

        im.dispatchAccepted("job-redispatch");
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 3: attempt 2 NOT stalled by the prior reject (scoped out) → fires
        callExecutor.drain();                                     // call thread adopts attempt 2's response

        TaskAttempt latest = attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow();
        assertThat(latest.getAttemptNo()).isEqualTo(2);
        assertThat(latest.getResponse()).isEqualTo("job-redispatch");
    }

    @Test
    void redispatchCorrelationIsClockIndependent() {
        // Defect-2 regression: observation→attempt correlation is by attempt_id, NOT wall-clock started_at, so a
        // stale prior-attempt reject never double-fails the new attempt even when the clock does NOT advance
        // between the reject and the new attempt (the backward-clock-step hazard). Clock stays FIXED here.
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DISPATCHING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(NOW).build());
        im.setRunTerraform(FakeImClient.reject());
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires reject (queued)
        callExecutor.drain();                             // attempt 1's (ERROR, IM_REJECTED) row at started_at=NOW, attempt_id=1
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads reject → attempt 1 fails, attempt 2 opens at started_at=NOW

        im.dispatchAccepted("job-2");
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 3: attempt 2 (id≠1) is NOT stalled by the same-instant stale reject
        callExecutor.drain();

        TaskAttempt latest = attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId()).orElseThrow();
        assertThat(latest.getAttemptNo()).isEqualTo(2);
        assertThat(latest.getResponse()).isEqualTo("job-2");          // attempt 2 dispatched normally
        assertThat(reload(task).getFailCount()).isEqualTo(1);          // exactly ONE fail (attempt 1), never double-counted
    }

    @Test
    void runningPollSucceededBeatsAnExpiredExecutionDeadline() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).build());
        task.setDeadlineAt(NOW.minus(Duration.ofSeconds(1))); // execution deadline already passed
        tasks.save(task);
        seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: fires poll (queued)
        callExecutor.drain();                             // call thread writes the SUCCEEDED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: SUCCEEDED beats the passed deadline → DONE

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.DONE); // completed observation beats timeout
    }

    @Test
    void cancellingRunningDrainFailedTerminatesAsFailedAndCounts() {
        Pipeline pipeline = seedPipeline(PipelineStatus.CANCELLING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).operation(TF_OP).failCount(0).maxFailCount(3).build());
        TaskAttempt attempt = seedAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).response("job-9").startedAt(NOW).build());
        im.setTerraformJobStatus(FakeImClient.jobStatus("FAILED"));

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build()); // tick 1: drain fires the poll (queued)
        callExecutor.drain();                             // call thread writes the FAILED observation
        clock.advance(STEP);
        advancer.advance(TaskTick.builder().pipeline(pipeline).task(reload(task)).due(true).budget(budget()).build()); // tick 2: reads FAILED → FAILED (drain: no requeue)

        assertThat(reload(task).getStatus()).isEqualTo(TaskStatus.FAILED); // real failure recorded, no requeue
        assertThat(reload(task).getFailCount()).isEqualTo(1);
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getErrorCode()).isEqualTo(ErrorCode.JOB_FAILED);
    }

    @Test
    void aTransitionEmitsAPipelineEvent() {
        Pipeline pipeline = seedPipeline(PipelineStatus.RUNNING);
        Task task = seedTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.BLOCKED).operation(TF_OP).build());

        advancer.advance(TaskTick.builder().pipeline(pipeline).task(task).due(true).budget(budget()).build());

        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(pipeline.getId())).singleElement()
                .satisfies((PipelineEvent event) -> {
                    assertThat(event.getType()).isEqualTo(PipelineEventType.TASK_READY.wire());
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

    private Task seedTask(TaskSeed seed) {
        Task t = new Task();
        t.setPipelineId(seed.pipelineId);
        t.setSeq(seed.seq);
        t.setName("task-" + seed.seq);
        t.setOperation(seed.operation);
        t.setKind(seed.kind);
        t.setStatus(seed.status);
        t.setFailCount(seed.failCount);
        t.setMaxFailCount(seed.maxFailCount);
        return tasks.save(t);
    }

    private TaskAttempt seedAttempt(AttemptSeed seed) {
        TaskAttempt a = new TaskAttempt();
        a.setTaskId(seed.taskId);
        a.setAttemptNo(seed.attemptNo);
        a.setResponse(seed.response);
        a.setStartedAt(seed.startedAt);
        a.setFinishedAt(seed.finishedAt);
        return attempts.save(a);
    }

    private TaskCheck dispatchObservation(DispatchObservationSeed seed) {
        TaskCheck c = new TaskCheck();
        c.setTaskId(seed.taskId);
        c.setAttemptId(seed.attemptId); // the tick scopes the DISPATCH read by attempt id (clock-independent)
        c.setKind(CheckKind.DISPATCH);
        c.setName(TF_OP + ":dispatch");
        c.setApiResult(seed.apiResult);
        c.setErrorCode(seed.errorCode);
        c.setPollCount(1);
        c.setStartedAt(NOW);
        c.setCheckedAt(NOW);
        return c;
    }

    /** Test seed for {@link #seedTask}: failCount defaults to 0, maxFailCount to 3. */
    @lombok.Builder
    private static class TaskSeed {
        private final Long pipelineId;
        private final int seq;
        private final TaskKind kind;
        private final TaskStatus status;
        private final String operation;
        @lombok.Builder.Default
        private final int failCount = 0;
        @lombok.Builder.Default
        private final int maxFailCount = 3;
    }

    @lombok.Builder
    private static class AttemptSeed {
        private final Long taskId;
        private final int attemptNo;
        private final String response;
        private final Instant startedAt;
        private final Instant finishedAt;
    }

    @lombok.Builder
    private static class DispatchObservationSeed {
        private final Long taskId;
        private final Long attemptId;
        private final ApiResult apiResult;
        private final ErrorCode errorCode;
    }

    /** A committed CONDITION_CHECK error run (RLE) representing {@code pollCount} failed CHECK calls. Its name
     *  matches the launcher's operation id ({@code operation:check}) so a fired check collapses into it. */
    private TaskCheck conditionCheckError(Long taskId, int pollCount) {
        TaskCheck c = new TaskCheck();
        c.setTaskId(taskId);
        c.setKind(CheckKind.CHECK);
        c.setName(COND_OP + ":check");
        c.setApiResult(ApiResult.ERROR);
        c.setErrorCode(ErrorCode.CHECK_ERROR);
        c.setPollCount(pollCount);
        c.setStartedAt(NOW.minus(Duration.ofMinutes(20)));
        c.setCheckedAt(NOW.minus(Duration.ofMinutes(20)));
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
        @Bean MutableClock clock() {
            return new MutableClock(NOW);
        }

        @Bean PipelineEngineSettings pipelineEngineSettings() {
            return PipelineEngineSettings.builder()
                    .slotCap(1) // one slot → deterministic admission tests
                    .build();
        }

        @Bean ReconcileLeader leader() {
            return new ReconcileLeader();
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
     * committed (so the observation's REQUIRES_NEW write commits cleanly, with no nested-in-tick lock contention
     * and no commit-order inversion against the tick's schedule write).
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

    /**
     * A mutable {@link Clock}: a shared singleton the test advances between ticks so each attempt/observation
     * gets a strictly-monotonic timestamp (as production's wall clock does). Reset to {@link #NOW} before each
     * test; single-tick tests never advance it and behave exactly like a fixed clock.
     */
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

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
