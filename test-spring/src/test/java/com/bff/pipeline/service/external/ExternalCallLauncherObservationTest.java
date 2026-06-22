package com.bff.pipeline.service.external;

import com.bff.pipeline.client.FakeImClient;
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
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.Executor;

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
 * cannot leak into another test.
 *
 * <p>There is no executor seam anymore — the launcher folds the per-call deadline in. The test seam is the
 * settable fake {@link com.bff.pipeline.client.ImClient}: a value, a thrown fault (REJECT / BACKPRESSURE), a
 * latency simulated by advancing the shared {@link MutableClock} ({@link #latency}), or a CALL_TIMEOUT
 * simulated by a behavior that blocks past the small {@code perCallDeadline} ({@link #slowerThanDeadline}).
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
    private static final String TF_OP = "apply-network";
    private static final String COND_OP = "network-ready";
    /** The Wiring's perCallDeadline; a behavior that blocks longer than this trips CALL_TIMEOUT. */
    private static final Duration PER_CALL_DEADLINE = Duration.ofMillis(100);

    @Autowired
    private ExternalCallLauncher externalCalls;
    @Autowired
    private TaskCheckRepository checks;
    @Autowired
    private TaskAttemptRepository attempts;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private MutableClock clock;
    @Autowired
    private ManualCallExecutor callExecutor;
    @Autowired
    private FakeImClient im;

    @AfterEach
    void cleanup() {
        clock.set(FIXED);
        im.dispatchAccepted(HANDLE);
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        im.setCheckCondition(FakeImClient.condition(false));
        callExecutor.drain(); // discard any un-drained queued call so it cannot leak into the next test
        checks.deleteAll();
        attempts.deleteAll();
        tasks.deleteAll();
    }

    /** A behavior that returns {@code value} after advancing the clock by {@code ms} (a simulated latency). */
    private FakeImClient.Behavior latency(long ms, String value) {
        return () -> {
            clock.advance(Duration.ofMillis(ms));
            return value;
        };
    }

    /** A behavior that blocks past the per-call deadline, so {@code future.get(deadline)} trips CALL_TIMEOUT. */
    private static FakeImClient.Behavior slowerThanDeadline(String wouldBeValue) {
        return () -> {
            try {
                Thread.sleep(PER_CALL_DEADLINE.toMillis() * 20);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return wouldBeValue;
        };
    }

    // ---- dispatch ----

    @Test
    void dispatchAcceptedRecordsOkDispatchRowAndAdoptsResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        im.setRunTerraform(latency(42, HANDLE));

        externalCalls.dispatch(task, attempt, TARGET);
        callExecutor.drain();

        List<TaskCheck> rows = checks.findByTaskIdOrderByStartedAtAsc(task.getId());
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getKind()).isEqualTo(CheckKind.DISPATCH);
            assertThat(row.getApiResult()).isEqualTo(ApiResult.OK);
            assertThat(row.getExternalHandle()).isEqualTo(HANDLE);
            assertThat(row.getPollCount()).isEqualTo(1);
            assertThat(row.getLatencyMs()).isEqualTo(42L);
            assertThat(row.getErrorCode()).isNull();
        });
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isEqualTo(HANDLE);
    }

    @Test
    void dispatchRejectedRecordsErrorDispatchRowWithImRejectedAndNoResponse() {
        Task task = seedTask(TaskStatus.DISPATCHING, TaskKind.TERRAFORM_JOB);
        TaskAttempt attempt = seedOpenAttempt(task.getId());
        im.setRunTerraform(FakeImClient.reject());

        externalCalls.dispatch(task, attempt, TARGET);
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
        // The IM would have accepted, but it blocks past the per-call deadline → outcome is TIMEOUT.
        im.setRunTerraform(slowerThanDeadline(HANDLE));

        externalCalls.dispatch(task, attempt, TARGET);
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
        im.setRunTerraform(FakeImClient.backpressure(10L)); // 429/503 + Retry-After 10s

        externalCalls.dispatch(task, attempt, TARGET);
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

        // Drain after EACH poll: a queued call reads the IM outcome at run time, so the call thread must
        // run before the next outcome is scripted (faithful to one fired call per drain).
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();

        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));
        externalCalls.poll(task, attempt, TARGET);
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

        im.setTerraformJobStatus(latency(100, "RUNNING"));
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();
        im.setTerraformJobStatus(latency(250, "RUNNING"));
        externalCalls.poll(task, attempt, TARGET);
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
        im.setTerraformJobStatus(FakeImClient.reject()); // a read error → CHECK_ERROR

        externalCalls.poll(task, attempt, TARGET);
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
        im.setTerraformJobStatus(FakeImClient.jobStatus("RUNNING"));
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();

        im.setTerraformJobStatus(FakeImClient.jobStatus("SUCCEEDED"));
        externalCalls.poll(task, attempt, TARGET);
        callExecutor.drain();
        externalCalls.poll(task, attempt, TARGET);
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
        im.setTerraformJobStatus(slowerThanDeadline("RUNNING")); // would-be value; the deadline fires first

        externalCalls.poll(task, attempt, TARGET);
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
        im.setCheckCondition(FakeImClient.condition(false));
        externalCalls.check(task, TARGET);
        callExecutor.drain();
        externalCalls.check(task, TARGET);
        callExecutor.drain();

        im.setCheckCondition(FakeImClient.condition(true));
        externalCalls.check(task, TARGET);
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
        im.setCheckCondition(FakeImClient.backpressure(5L)); // Retry-After 5s, below the guard floor

        externalCalls.check(task, TARGET);
        callExecutor.drain();

        // next_check_at = now + max(Retry-After 5s, conditionPollingGuard 10m) = now + 10m.
        assertThat(tasks.findById(task.getId()).orElseThrow().getNextCheckAt())
                .isEqualTo(FIXED.plus(Duration.ofMinutes(10)));
    }

    @Test
    void checkExecutorTimeoutRecordsCallTimeoutErrorRun() {
        Task task = seedTask(TaskStatus.WAITING_EXTERNAL, TaskKind.CONDITION_CHECK);
        im.setCheckCondition(slowerThanDeadline("NOT_MET")); // would-be value; deadline fires first

        externalCalls.check(task, TARGET);
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
        task.setOperation(kind == TaskKind.TERRAFORM_JOB ? TF_OP : COND_OP);
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
     * Test wiring: a shared {@link MutableClock} (a behavior advances it to simulate latency), default
     * {@link PipelineEngineSettings} but with a small {@code perCallDeadline} (so a slow behavior trips
     * CALL_TIMEOUT quickly), the queueing {@link ManualCallExecutor} for the fire-and-forget pool, and the
     * settable fake {@link com.bff.pipeline.client.ImClient} whose returned value / simulated fault / latency
     * is set by the test before each call.
     */
    @TestConfiguration
    static class Wiring {

        @Bean
        MutableClock clock() {
            return new MutableClock(FIXED);
        }

        @Bean
        PipelineEngineSettings pipelineEngineSettings() {
            return PipelineEngineSettings.builder().perCallDeadline(PER_CALL_DEADLINE).build();
        }

        /** The fire-and-forget pool ({@link ExternalCallLauncher} @Qualifier): queue the call so the test runs it
         *  explicitly with {@code drain()}, modelling production's async boundary. */
        @Bean
        Executor pipelineCallExecutor() {
            return new ManualCallExecutor();
        }

        @Bean
        FakeImClient fakeImClient() {
            return new FakeImClient();
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
     * A mutable {@link Clock} the launcher reads around each call to measure latency; a scripted behavior
     * advances it by the latency it wants to simulate. Reset to {@link #FIXED} before each test.
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
