package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
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
import com.bff.pipeline.handler.PollContext;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
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
import java.util.List;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The call-thread ({@link ExternalCalls}) + its write side ({@link ObservationWriter}, REQUIRES_NEW). Each
 * call returns the handler outcome AND commits the {@code task_check} observation / dispatch response /
 * backpressure {@code next_check_at} in an independent transaction.
 *
 * <p>Because {@code ObservationWriter} is {@code REQUIRES_NEW}, its writes COMMIT independently; a test
 * wrapping transaction would mask that (the docs' one exception to "no @Transactional in tests": we suppress
 * the wrapper with {@link Propagation#NOT_SUPPORTED} to un-mask the real commit). Seeds and assertions
 * therefore go through the repos (each its own committed tx), and {@link #cleanup()} deletes every committed
 * row so it cannot leak into another test. The {@link Wiring} fixes the {@link Clock} and supplies a
 * synchronous {@link ExternalCallExecutor} whose latency/timeout is settable per test — when it does not time
 * out it returns {@code work.get()} so the FAKE HANDLER decides the outcome.
 */
@DataJpaTest
@Import({
        ExternalCalls.class,
        ObservationWriter.class,
        com.bff.pipeline.ops.RuntimeSettings.class,
        ExternalCallsObservationTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ExternalCallsObservationTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");
    private static final String TARGET = "ts-external-1";
    private static final String HANDLE = "job-1";

    @Autowired
    private ExternalCalls externalCalls;
    @Autowired
    private TaskCheckRepository checks;
    @Autowired
    private TaskAttemptRepository attempts;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private FakeExecutor executor;
    @Autowired
    private FakeTerraformHandler tfHandler;
    @Autowired
    private FakeConditionHandler condHandler;

    @AfterEach
    void cleanup() {
        executor.reset();
        checks.deleteAll();
        attempts.deleteAll();
        tasks.deleteAll();
    }

    // ---- dispatch ----

    @Test
    void dispatchAcceptedRecordsOkDispatchRowAndAdoptsResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        executor.setLatencyMs(42);
        tfHandler.setDispatch(new DispatchOutcome.Accepted(HANDLE));

        DispatchOutcome outcome = externalCalls.dispatch(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isEqualTo(new DispatchOutcome.Accepted(HANDLE));
        List<TaskCheck> rows = checks.findByTaskIdOrderByStartedAtAsc(task.getId());
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getKind()).isEqualTo(CheckKind.DISPATCH);
            assertThat(row.getApiResult()).isEqualTo(ApiResult.OK);
            assertThat(row.getExternalHandle()).isEqualTo(HANDLE);
            assertThat(row.getPollCount()).isEqualTo(1);
            assertThat(row.getCheckedAt()).isEqualTo(FIXED);
            assertThat(row.getLatencyMs()).isEqualTo(42L);
            assertThat(row.getErrorCode()).isNull();
        });
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isEqualTo(HANDLE);
    }

    @Test
    void dispatchRejectedRecordsErrorDispatchRowWithoutErrorCodeOrResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        tfHandler.setDispatch(new DispatchOutcome.Rejected("boom"));

        DispatchOutcome outcome = externalCalls.dispatch(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isInstanceOf(DispatchOutcome.Rejected.class);
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(row -> {
            assertThat(row.getKind()).isEqualTo(CheckKind.DISPATCH);
            assertThat(row.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(row.getErrorCode()).isNull();
            assertThat(row.getExternalHandle()).isNull();
        });
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void dispatchCallTimeoutReturnsCallTimeoutAndRecordsCallTimeoutErrorCode() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        // The handler would have Accepted, but the executor deadline fires first → outcome is CallTimeout.
        tfHandler.setDispatch(new DispatchOutcome.Accepted(HANDLE));
        executor.setTimedOut(true);

        DispatchOutcome outcome = externalCalls.dispatch(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isInstanceOf(DispatchOutcome.CallTimeout.class);
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(row -> {
            assertThat(row.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(row.getErrorCode()).isEqualTo(ErrorCode.CALL_TIMEOUT);
        });
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void dispatchBackpressureAdvancesNextCheckAtByRetryAfterWithoutResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        tfHandler.setDispatch(new DispatchOutcome.Backpressure(Duration.ofSeconds(10)));

        DispatchOutcome outcome = externalCalls.dispatch(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isInstanceOf(DispatchOutcome.Backpressure.class);
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(row -> {
            assertThat(row.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(row.getErrorCode()).isNull();
        });
        // dispatch has no cadence floor: next_check_at = now + Retry-After (10s) exactly.
        assertThat(tasks.findById(task.getId()).orElseThrow().getNextCheckAt())
                .isEqualTo(FIXED.plusSeconds(10));
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    // ---- poll (CHECK, RLE) ----

    @Test
    void identicalPollsCollapseAndAnObservationChangeOpensASecondRun() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);

        tfHandler.setPoll(new PollOutcome.Status(Observed.RUNNING));
        externalCalls.poll(task, attempt, tfHandler, TARGET);
        externalCalls.poll(task, attempt, tfHandler, TARGET);

        tfHandler.setPoll(new PollOutcome.Status(Observed.SUCCEEDED));
        externalCalls.poll(task, attempt, tfHandler, TARGET);

        List<TaskCheck> runs = checks.findByTaskIdOrderByStartedAtAsc(task.getId());
        assertThat(runs).hasSize(2);

        TaskCheck running = runs.get(0);
        assertThat(running.getKind()).isEqualTo(CheckKind.CHECK);
        assertThat(running.getObserved()).isEqualTo(Observed.RUNNING);
        assertThat(running.getPollCount()).isEqualTo(2);
        assertThat(running.getExternalHandle()).isEqualTo(HANDLE);
        assertThat(running.getApiResult()).isEqualTo(ApiResult.OK);

        TaskCheck succeeded = runs.get(1);
        assertThat(succeeded.getObserved()).isEqualTo(Observed.SUCCEEDED);
        assertThat(succeeded.getPollCount()).isEqualTo(1);
        assertThat(succeeded.getExternalHandle()).isEqualTo(HANDLE);
    }

    @Test
    void collapsedRunOverwritesLatencyWithTheLastPollNotTheSum() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);
        tfHandler.setPoll(new PollOutcome.Status(Observed.RUNNING));

        executor.setLatencyMs(100);
        externalCalls.poll(task, attempt, tfHandler, TARGET);
        executor.setLatencyMs(250);
        externalCalls.poll(task, attempt, tfHandler, TARGET);

        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(run -> {
            assertThat(run.getPollCount()).isEqualTo(2);
            assertThat(run.getLatencyMs()).isEqualTo(250L); // last poll, not 350 (sum) / 175 (avg)
        });
    }

    @Test
    void pollCallFailedRecordsErrorRunWithCheckErrorCode() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);
        tfHandler.setPoll(new PollOutcome.CallFailed(ErrorCode.CHECK_ERROR));

        PollOutcome outcome = externalCalls.poll(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isEqualTo(new PollOutcome.CallFailed(ErrorCode.CHECK_ERROR));
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(run -> {
            assertThat(run.getKind()).isEqualTo(CheckKind.CHECK);
            assertThat(run.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(run.getErrorCode()).isEqualTo(ErrorCode.CHECK_ERROR);
            assertThat(run.getObserved()).isNull();
        });
    }

    @Test
    void aSecondRunCollapsesIntoTheLatestRunNotAnEarlierIdenticalKey() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);

        tfHandler.setPoll(new PollOutcome.Status(Observed.RUNNING));
        externalCalls.poll(task, attempt, tfHandler, TARGET);
        externalCalls.poll(task, attempt, tfHandler, TARGET);

        tfHandler.setPoll(new PollOutcome.Status(Observed.SUCCEEDED));
        externalCalls.poll(task, attempt, tfHandler, TARGET);
        externalCalls.poll(task, attempt, tfHandler, TARGET);

        // Two runs, each folding two polls. Under the fixed clock both runs share started_at, so the
        // 4th poll (SUCCEEDED) must collapse into the LATEST run by the id tiebreak — not reopen against
        // the earlier RUNNING run, which would spuriously create a third run.
        List<TaskCheck> runs = checks.findByTaskIdOrderByStartedAtAsc(task.getId());
        assertThat(runs).hasSize(2);
        assertThat(runs.get(0).getObserved()).isEqualTo(Observed.RUNNING);
        assertThat(runs.get(0).getPollCount()).isEqualTo(2);
        assertThat(runs.get(1).getObserved()).isEqualTo(Observed.SUCCEEDED);
        assertThat(runs.get(1).getPollCount()).isEqualTo(2);
    }

    @Test
    void pollExecutorTimeoutRecordsCallTimeoutErrorRun() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);
        tfHandler.setPoll(new PollOutcome.Status(Observed.RUNNING)); // would-be value; the deadline fires first
        executor.setTimedOut(true);

        PollOutcome outcome = externalCalls.poll(task, attempt, tfHandler, TARGET);

        assertThat(outcome).isEqualTo(new PollOutcome.CallFailed(ErrorCode.CALL_TIMEOUT));
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(run -> {
            assertThat(run.getKind()).isEqualTo(CheckKind.CHECK);
            assertThat(run.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(run.getErrorCode()).isEqualTo(ErrorCode.CALL_TIMEOUT);
        });
    }

    // ---- check (CONDITION_CHECK, RLE) ----

    @Test
    void notMetChecksCollapseThenMetOpensANewRun() {
        Task task = seedTask(TaskStatus.WAITING_EXTERNAL, TaskKind.CONDITION_CHECK);

        condHandler.setCheck(new CheckOutcome.Condition(Observed.NOT_MET));
        externalCalls.check(task, condHandler, TARGET);
        externalCalls.check(task, condHandler, TARGET);

        condHandler.setCheck(new CheckOutcome.Condition(Observed.MET));
        externalCalls.check(task, condHandler, TARGET);

        List<TaskCheck> runs = checks.findByTaskIdOrderByStartedAtAsc(task.getId());
        assertThat(runs).hasSize(2);

        TaskCheck notMet = runs.get(0);
        assertThat(notMet.getKind()).isEqualTo(CheckKind.CHECK);
        assertThat(notMet.getObserved()).isEqualTo(Observed.NOT_MET);
        assertThat(notMet.getPollCount()).isEqualTo(2);
        assertThat(notMet.getExternalHandle()).isNull();

        TaskCheck met = runs.get(1);
        assertThat(met.getObserved()).isEqualTo(Observed.MET);
        assertThat(met.getPollCount()).isEqualTo(1);
        assertThat(met.getExternalHandle()).isNull();
    }

    @Test
    void checkBackpressureDefersNextCheckAtToTheConditionPollingGuardFloor() {
        Task task = seedTask(TaskStatus.WAITING_EXTERNAL, TaskKind.CONDITION_CHECK);
        condHandler.setCheck(new CheckOutcome.Backpressure(Duration.ofSeconds(5)));

        CheckOutcome outcome = externalCalls.check(task, condHandler, TARGET);

        assertThat(outcome).isInstanceOf(CheckOutcome.Backpressure.class);
        // next_check_at = now + max(Retry-After 5s, conditionPollingGuard 10m) = now + 10m.
        assertThat(tasks.findById(task.getId()).orElseThrow().getNextCheckAt())
                .isEqualTo(FIXED.plus(Duration.ofMinutes(10)));
    }

    @Test
    void checkExecutorTimeoutRecordsCallTimeoutErrorRun() {
        Task task = seedTask(TaskStatus.WAITING_EXTERNAL, TaskKind.CONDITION_CHECK);
        condHandler.setCheck(new CheckOutcome.Condition(Observed.NOT_MET)); // would-be value; deadline fires first
        executor.setTimedOut(true);

        CheckOutcome outcome = externalCalls.check(task, condHandler, TARGET);

        assertThat(outcome).isEqualTo(new CheckOutcome.CallFailed(ErrorCode.CALL_TIMEOUT));
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(run -> {
            assertThat(run.getKind()).isEqualTo(CheckKind.CHECK);
            assertThat(run.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(run.getErrorCode()).isEqualTo(ErrorCode.CALL_TIMEOUT);
        });
    }

    // ---- seed helpers (committed via repos; no test tx) ----

    private Task seedTask(TaskStatus status, TaskKind kind) {
        Task task = new Task();
        task.setPipelineId(1L);
        task.setSeq(0);
        task.setName("apply network");
        task.setHandlerKey(kind == TaskKind.TERRAFORM_JOB ? FakeTerraformHandler.KEY : FakeConditionHandler.KEY);
        task.setKind(kind);
        task.setStatus(status);
        task.setMaxFailCount(3);
        task.setFailCount(0);
        return tasks.save(task);
    }

    private TaskAttempt seedOpenAttempt(Long taskId) {
        return seedAttemptWithResponse(taskId, null);
    }

    private TaskAttempt seedAttemptWithResponse(Long taskId, String response) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(taskId);
        attempt.setAttemptNo(1);
        attempt.setStartedAt(Instant.parse("2026-06-21T10:10:00Z"));
        attempt.setResponse(response);
        attempt.setFinishedAt(null);
        return attempts.save(attempt);
    }

    /**
     * Test wiring: a fixed {@link Clock}, default {@link PipelineSettings} (perCallDeadline 30s,
     * jobPollCadence 45s, conditionPollingGuard 10m), the settable synchronous executor, and the two settable
     * fake handlers. Handlers are stateless stubs whose returned outcome is set by the test before each call.
     */
    @TestConfiguration
    static class Wiring {

        @Bean
        Clock clock() {
            return Clock.fixed(FIXED, ZoneOffset.UTC);
        }

        @Bean
        PipelineSettings pipelineSettings() {
            return new PipelineSettings();
        }

        @Bean
        FakeExecutor fakeExecutor() {
            return new FakeExecutor();
        }

        @Bean
        FakeTerraformHandler fakeTerraformHandler() {
            return new FakeTerraformHandler();
        }

        @Bean
        FakeConditionHandler fakeConditionHandler() {
            return new FakeConditionHandler();
        }
    }

    /**
     * Synchronous {@link ExternalCallExecutor}. When not timing out it returns the handler's value
     * ({@code work.get()}) so the FAKE HANDLER owns the outcome; when timing out it returns a null value with
     * {@code timedOut=true}. Latency and timeout are settable per test.
     */
    static final class FakeExecutor implements ExternalCallExecutor {

        private long latencyMs = 5;
        private boolean timedOut = false;

        void setLatencyMs(long latencyMs) {
            this.latencyMs = latencyMs;
        }

        void setTimedOut(boolean timedOut) {
            this.timedOut = timedOut;
        }

        void reset() {
            this.latencyMs = 5;
            this.timedOut = false;
        }

        @Override
        public <T> CallOutcome<T> call(Supplier<T> work, Duration deadline) {
            if (timedOut) {
                return new CallOutcome<>(null, latencyMs, true);
            }
            return new CallOutcome<>(work.get(), latencyMs, false);
        }
    }

    /** Settable TERRAFORM_JOB handler — dispatch/poll return the last outcome the test scripted. */
    static final class FakeTerraformHandler implements TerraformJobHandler {
        static final String KEY = "test.tf.apply";

        private DispatchOutcome dispatchOutcome = new DispatchOutcome.Accepted(HANDLE);
        private PollOutcome pollOutcome = new PollOutcome.Status(Observed.RUNNING);

        void setDispatch(DispatchOutcome outcome) {
            this.dispatchOutcome = outcome;
        }

        void setPoll(PollOutcome outcome) {
            this.pollOutcome = outcome;
        }

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public DispatchOutcome dispatch(DispatchContext ctx) {
            return dispatchOutcome;
        }

        @Override
        public PollOutcome poll(PollContext ctx) {
            return pollOutcome;
        }
    }

    /** Settable CONDITION_CHECK handler — check returns the last outcome the test scripted. */
    static final class FakeConditionHandler implements ConditionCheckHandler {
        static final String KEY = "test.cond.ready";

        private CheckOutcome checkOutcome = new CheckOutcome.Condition(Observed.NOT_MET);

        void setCheck(CheckOutcome outcome) {
            this.checkOutcome = outcome;
        }

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public CheckOutcome check(CheckContext ctx) {
            return checkOutcome;
        }
    }
}
