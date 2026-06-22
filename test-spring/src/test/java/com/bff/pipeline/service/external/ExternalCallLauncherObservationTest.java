package com.bff.pipeline.service.external;
import com.bff.pipeline.dto.ExternalCallOutcome;
import com.bff.pipeline.dto.TerraformJobCall;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;
import com.bff.pipeline.service.handler.ConditionCheckHandler;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;
import com.bff.pipeline.service.handler.TerraformJobHandler;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
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
import java.util.List;
import java.util.concurrent.Executor;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The call-thread ({@link ExternalCallLauncher}) + its write side ({@link TaskCheckObservationWriter}, REQUIRES_NEW). The
 * dispatch/poll/check methods are fire-and-forget (D-T2): they FIRE the call on the {@code pipelineCallExecutor}
 * and return void. The committed {@code task_check} observation / dispatch response / backpressure
 * {@code next_check_at} ARE the contract — asserted after the fired call runs.
 *
 * <p>The {@link ManualCallExecutor} queues the fired call so the test runs it explicitly with
 * {@code callExecutor.drain()}; because {@code TaskCheckObservationWriter} is {@code REQUIRES_NEW}, its writes COMMIT
 * independently of any test transaction (the docs' one exception to "no @Transactional in tests": we suppress
 * the wrapper with {@link Propagation#NOT_SUPPORTED} to un-mask the real commit). Seeds and assertions go
 * through the repos (each its own committed tx), and {@link #cleanup()} deletes every committed row so it
 * cannot leak into another test. The {@link Wiring} fixes the {@link Clock} and supplies a synchronous
 * {@link ExternalCallExecutor} whose latency/timeout is settable per test — when it does not time out it
 * returns {@code work.get()} so the FAKE HANDLER decides the outcome.
 */
@DataJpaTest
@Import({
        ExternalCallLauncher.class,
        TaskCheckObservationWriter.class,
        ExternalCallLauncherObservationTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ExternalCallLauncherObservationTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");
    private static final String TARGET = "ts-external-1";
    private static final String HANDLE = "job-1";

    @Autowired
    private ExternalCallLauncher externalCalls;
    @Autowired
    private TaskCheckRepository checks;
    @Autowired
    private TaskAttemptRepository attempts;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private FakeExecutor executor;
    @Autowired
    private ManualCallExecutor callExecutor;
    @Autowired
    private FakeTerraformHandler tfHandler;
    @Autowired
    private FakeConditionHandler condHandler;

    @AfterEach
    void cleanup() {
        executor.reset();
        callExecutor.drain(); // discard any un-drained queued call so it cannot leak into the next test
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
        tfHandler.setDispatch(TerraformDispatchOutcome.Accepted.builder().handle(HANDLE).build());

        externalCalls.dispatch(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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
    void dispatchRejectedRecordsErrorDispatchRowWithImRejectedAndNoResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        tfHandler.setDispatch(TerraformDispatchOutcome.Rejected.builder().detail("boom").build());

        externalCalls.dispatch(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

        // The reject row carries error_code=IM_REJECTED so the next tick tells it apart from the
        // (ERROR, observed=null, error_code=null) backpressure marker (the async single writer reads the row).
        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(row -> {
            assertThat(row.getKind()).isEqualTo(CheckKind.DISPATCH);
            assertThat(row.getApiResult()).isEqualTo(ApiResult.ERROR);
            assertThat(row.getErrorCode()).isEqualTo(ErrorCode.IM_REJECTED);
            assertThat(row.getExternalHandle()).isNull();
        });
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void dispatchCallTimeoutRecordsCallTimeoutErrorCode() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        // The handler would have Accepted, but the executor deadline fires first → outcome is CallTimeout.
        tfHandler.setDispatch(TerraformDispatchOutcome.Accepted.builder().handle(HANDLE).build());
        executor.setTimedOut(true);

        externalCalls.dispatch(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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
        tfHandler.setDispatch(TerraformDispatchOutcome.Backpressure.builder().retryAfter(Duration.ofSeconds(10)).build());

        externalCalls.dispatch(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

        // Backpressure is the (ERROR, observed=null, error_code=null) marker — distinct from the reject row.
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

        // Drain after EACH poll: a queued call reads the handler outcome at run time, so the call thread must
        // run before the next outcome is scripted (faithful to one fired call per drain).
        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.RUNNING).build());
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.SUCCEEDED).build());
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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
        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.RUNNING).build());

        executor.setLatencyMs(100);
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();
        executor.setLatencyMs(250);
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

        assertThat(checks.findByTaskIdOrderByStartedAtAsc(task.getId())).singleElement().satisfies(run -> {
            assertThat(run.getPollCount()).isEqualTo(2);
            assertThat(run.getLatencyMs()).isEqualTo(250L); // last poll, not 350 (sum) / 175 (avg)
        });
    }

    @Test
    void pollCallFailedRecordsErrorRunWithCheckErrorCode() {
        Task task = seedTask(TaskStatus.RUNNING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedAttemptWithResponse(task.getId(), HANDLE);
        tfHandler.setPoll(TerraformPollOutcome.CallFailed.builder().reason(ErrorCode.CHECK_ERROR).build());

        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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

        // Drain after EACH poll so each call observes its scripted outcome (one fired call per drain).
        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.RUNNING).build());
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.SUCCEEDED).build());
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();
        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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
        tfHandler.setPoll(TerraformPollOutcome.Status.builder().observed(Observed.RUNNING).build()); // would-be value; the deadline fires first
        executor.setTimedOut(true);

        externalCalls.poll(TerraformJobCall.builder().task(task).attempt(attempt).handler(tfHandler).targetSourceId(TARGET).build());
        callExecutor.drain();

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

        // Drain after EACH check so each call observes its scripted outcome (one fired call per drain).
        condHandler.setCheck(ConditionCheckOutcome.Condition.builder().observed(Observed.NOT_MET).build());
        externalCalls.check(task, condHandler, TARGET);
        callExecutor.drain();
        externalCalls.check(task, condHandler, TARGET);
        callExecutor.drain();

        condHandler.setCheck(ConditionCheckOutcome.Condition.builder().observed(Observed.MET).build());
        externalCalls.check(task, condHandler, TARGET);
        callExecutor.drain();

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
        condHandler.setCheck(ConditionCheckOutcome.Backpressure.builder().retryAfter(Duration.ofSeconds(5)).build());

        externalCalls.check(task, condHandler, TARGET);
        callExecutor.drain();

        // next_check_at = now + max(Retry-After 5s, conditionPollingGuard 10m) = now + 10m.
        assertThat(tasks.findById(task.getId()).orElseThrow().getNextCheckAt())
                .isEqualTo(FIXED.plus(Duration.ofMinutes(10)));
    }

    @Test
    void checkExecutorTimeoutRecordsCallTimeoutErrorRun() {
        Task task = seedTask(TaskStatus.WAITING_EXTERNAL, TaskKind.CONDITION_CHECK);
        condHandler.setCheck(ConditionCheckOutcome.Condition.builder().observed(Observed.NOT_MET).build()); // would-be value; deadline fires first
        executor.setTimedOut(true);

        externalCalls.check(task, condHandler, TARGET);
        callExecutor.drain();

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
     * Test wiring: a fixed {@link Clock}, default {@link PipelineEngineSettings} (perCallDeadline 30s,
     * jobPollCadence 45s, conditionPollingGuard 10m), the queueing {@link ManualCallExecutor} for the
     * fire-and-forget pool, the settable synchronous {@link ExternalCallExecutor}, and the two settable fake
     * handlers. Handlers are stateless stubs whose returned outcome is set by the test before each call.
     */
    @TestConfiguration
    static class Wiring {

        @Bean
        Clock clock() {
            return Clock.fixed(FIXED, ZoneOffset.UTC);
        }

        @Bean
        PipelineEngineSettings pipelineEngineSettings() {
            return PipelineEngineSettings.builder().build();
        }

        @Bean
        FakeExecutor fakeExecutor() {
            return new FakeExecutor();
        }

        /** The fire-and-forget pool ({@link ExternalCallLauncher} @Qualifier): queue the call so the test runs it
         *  explicitly with {@code drain()}, modelling production's async boundary. */
        @Bean
        Executor pipelineCallExecutor() {
            return new ManualCallExecutor();
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
     * Models the fire-and-forget pool ({@code pipelineCallExecutor}): a fired external call is QUEUED, not run
     * inline. {@link #drain()} runs every queued call so its REQUIRES_NEW observation write commits.
     */
    static final class ManualCallExecutor implements Executor {
        private final Deque<Runnable> queued = new ArrayDeque<>();

        @Override
        public void execute(Runnable command) {
            queued.add(command);
        }

        /** run every queued external call. */
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
        public <T> ExternalCallOutcome<T> call(Supplier<T> work, Duration deadline) {
            if (timedOut) {
                return ExternalCallOutcome.<T>builder().value(null).latencyMs(latencyMs).timedOut(true).build();
            }
            return ExternalCallOutcome.<T>builder().value(work.get()).latencyMs(latencyMs).timedOut(false).build();
        }
    }

    /** Settable TERRAFORM_JOB handler — dispatch/poll return the last outcome the test scripted. */
    static final class FakeTerraformHandler implements TerraformJobHandler {
        static final String KEY = "test.tf.apply";

        private TerraformDispatchOutcome dispatchOutcome = TerraformDispatchOutcome.Accepted.builder().handle(HANDLE).build();
        private TerraformPollOutcome pollOutcome = TerraformPollOutcome.Status.builder().observed(Observed.RUNNING).build();

        void setDispatch(TerraformDispatchOutcome outcome) {
            this.dispatchOutcome = outcome;
        }

        void setPoll(TerraformPollOutcome outcome) {
            this.pollOutcome = outcome;
        }

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public TerraformDispatchOutcome dispatch(TerraformDispatchContext ctx) {
            return dispatchOutcome;
        }

        @Override
        public TerraformPollOutcome poll(TerraformPollContext ctx) {
            return pollOutcome;
        }
    }

    /** Settable CONDITION_CHECK handler — check returns the last outcome the test scripted. */
    static final class FakeConditionHandler implements ConditionCheckHandler {
        static final String KEY = "test.cond.ready";

        private ConditionCheckOutcome checkOutcome = ConditionCheckOutcome.Condition.builder().observed(Observed.NOT_MET).build();

        void setCheck(ConditionCheckOutcome outcome) {
            this.checkOutcome = outcome;
        }

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public ConditionCheckOutcome check(ConditionCheckContext ctx) {
            return checkOutcome;
        }
    }
}
