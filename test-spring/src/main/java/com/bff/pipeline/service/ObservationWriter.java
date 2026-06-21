package com.bff.pipeline.service;

import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.TaskCheck;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

/**
 * The call-thread write side of the single-writer split (Decision 6, D-T4/D-T5): observation
 * ({@code task_check}), dispatch output ({@code task_attempt.response}), and the backpressure-only
 * {@code next_check_at} — never task status / fail_count / the normal next_check_at (those are the tick's).
 *
 * <p>Every method is {@code REQUIRES_NEW} so the observation commits independently of the tick transaction,
 * and the DISPATCH PENDING pre-record is its OWN committed transaction ({@link #prerecordDispatch}) so a
 * crash between the call and the response write still leaves the "attempted" marker (D-T5).
 */
@Component
class ObservationWriter {

    private final TaskCheckRepository checks;
    private final TaskAttemptRepository attempts;
    private final TaskRepository tasks;
    private final Clock clock;

    ObservationWriter(TaskCheckRepository checks, TaskAttemptRepository attempts, TaskRepository tasks, Clock clock) {
        this.checks = checks;
        this.attempts = attempts;
        this.tasks = tasks;
        this.clock = clock;
    }

    /** Step 2: pre-record the DISPATCH row PENDING in its own committed tx (crash leaves the attempt marker). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    long prerecordDispatch(long taskId, String name) {
        TaskCheck pending = new TaskCheck();
        pending.setTaskId(taskId);
        pending.setKind(CheckKind.DISPATCH);
        pending.setName(name);
        pending.setApiResult(ApiResult.PENDING);
        pending.setPollCount(1);
        pending.setStartedAt(clock.instant());
        return checks.save(pending).getId();
    }

    /**
     * Step 4: fill the pre-recorded DISPATCH row with the outcome, adopt the response on Accepted (write-once
     * CAS + late-response block), and on backpressure defer {@code next_check_at}. All one committed tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void completeDispatch(long checkId, long taskId, long attemptId, DispatchOutcome outcome,
                          long latencyMs, Instant backpressureNextCheckAt) {
        TaskCheck row = checks.findById(checkId)
                .orElseThrow(() -> new IllegalStateException("dispatch pre-record " + checkId + " missing"));
        row.setCheckedAt(clock.instant());
        row.setLatencyMs(latencyMs);
        switch (outcome) {
            case DispatchOutcome.Accepted a -> {
                row.setApiResult(ApiResult.OK);
                row.setExternalHandle(a.handle());
            }
            // IM_REJECTED is attributed to the attempt by the tick; backpressure is the (ERROR, error_code=null)
            // marker — both leave error_code null here.
            case DispatchOutcome.Rejected ignored -> row.setApiResult(ApiResult.ERROR);
            case DispatchOutcome.Backpressure ignored -> row.setApiResult(ApiResult.ERROR);
            case DispatchOutcome.CallTimeout ignored -> {
                row.setApiResult(ApiResult.ERROR);
                row.setErrorCode(ErrorCode.CALL_TIMEOUT);
            }
        }
        checks.save(row);

        if (outcome instanceof DispatchOutcome.Accepted a) {
            attempts.adoptResponseWhileDispatching(attemptId, a.handle());
        }
        if (backpressureNextCheckAt != null) {
            tasks.setNextCheckAt(taskId, backpressureNextCheckAt);
        }
    }

    /**
     * Record one CHECK observation (TERRAFORM_JOB poll or CONDITION_CHECK check) with RLE: an identical
     * {@code (apiResult, observed, errorCode)} folds into the open run (poll_count++, latency overwritten);
     * a changed observation opens a new run. On backpressure, defer {@code next_check_at}. One committed tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordCheckObservation(long taskId, String name, String handle, Observation obs,
                                long latencyMs, Instant backpressureNextCheckAt) {
        TaskCheck open = checks
                .findFirstByTaskIdAndKindAndNameAndExternalHandleOrderByStartedAtDescIdDesc(
                        taskId, CheckKind.CHECK, name, handle)
                .orElse(null);
        if (open != null && sameRun(open, obs)) {
            open.setCheckedAt(clock.instant());
            open.setPollCount(open.getPollCount() + 1);
            open.setLatencyMs(latencyMs); // last poll's latency — overwrite, not accumulate (§1.2)
            checks.save(open);
        } else {
            checks.save(newRun(taskId, name, handle, obs, latencyMs));
        }
        if (backpressureNextCheckAt != null) {
            tasks.setNextCheckAt(taskId, backpressureNextCheckAt);
        }
    }

    private TaskCheck newRun(long taskId, String name, String handle, Observation obs, long latencyMs) {
        Instant now = clock.instant();
        TaskCheck run = new TaskCheck();
        run.setTaskId(taskId);
        run.setKind(CheckKind.CHECK);
        run.setName(name);
        run.setExternalHandle(handle);
        run.setApiResult(obs.apiResult());
        run.setObserved(obs.observed());
        run.setErrorCode(obs.errorCode());
        run.setPollCount(1);
        run.setStartedAt(now);
        run.setCheckedAt(now);
        run.setLatencyMs(latencyMs);
        return run;
    }

    private static boolean sameRun(TaskCheck open, Observation obs) {
        return open.getApiResult() == obs.apiResult()
                && open.getObserved() == obs.observed()
                && open.getErrorCode() == obs.errorCode();
    }
}
