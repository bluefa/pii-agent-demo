package com.bff.pipeline.service.external;

import com.bff.pipeline.dto.CallResult;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CallStatus;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.lang.Nullable;
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
 * crash between the call and the response write still leaves the "attempted" marker (D-T5). Each write takes
 * plain request scalars (taskId / attemptId / name / handle) + the {@link CallResult} (the 4-way
 * {@link CallStatus} verdict, latency, the BACKPRESSURE Retry-After) and maps it onto the row; the backpressure
 * {@code next_check_at} is computed here from {@code callResult.retryAfter} + the injected clock.
 */
@Component
public class TaskCheckObservationWriter {

    private final TaskCheckRepository checks;
    private final TaskAttemptRepository attempts;
    private final TaskRepository tasks;
    private final Clock clock;

    TaskCheckObservationWriter(TaskCheckRepository checks, TaskAttemptRepository attempts, TaskRepository tasks, Clock clock) {
        this.checks = checks;
        this.attempts = attempts;
        this.tasks = tasks;
        this.clock = clock;
    }

    /** Step 2: pre-record the DISPATCH row PENDING in its own committed tx (crash leaves the attempt marker). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    long prerecordDispatch(long taskId, long attemptId, String name) {
        TaskCheck pending = new TaskCheck();
        pending.setTaskId(taskId);
        pending.setAttemptId(attemptId);
        pending.setKind(CheckKind.DISPATCH);
        pending.setName(name);
        pending.setApiResult(ApiResult.PENDING);
        pending.setPollCount(1);
        pending.setStartedAt(clock.instant());
        return checks.save(pending).getId();
    }

    /**
     * Step 4: fill the pre-recorded DISPATCH row with the result, adopt the response on SUCCESS (write-once
     * CAS + late-response block), and on backpressure defer {@code next_check_at}. All one committed tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void completeDispatch(long checkId, long taskId, long attemptId, CallResult result) {
        TaskCheck row = checks.findById(checkId)
                .orElseThrow(() -> new IllegalStateException("dispatch pre-record " + checkId + " missing"));
        row.setCheckedAt(clock.instant());
        row.setLatencyMs(result.getLatencyMs());
        switch (result.getStatus()) {
            case SUCCESS -> {
                row.setApiResult(ApiResult.OK);
                row.setExternalHandle(result.getValue());
            }
            // A hard reject carries error_code=IM_REJECTED on the observation so the NEXT tick can tell it
            // apart from the (ERROR, observed=null, error_code=null) backpressure marker — the async single
            // writer reads the committed row, not a return value (state-machine 114/115). The attempt is
            // ALSO closed IM_REJECTED by the tick (the row is the ledger; the attempt is the fail home).
            case REJECT -> {
                row.setApiResult(ApiResult.ERROR);
                row.setErrorCode(ErrorCode.IM_REJECTED);
            }
            case BACKPRESSURE -> row.setApiResult(ApiResult.ERROR); // (ERROR, null, null) marker
            case TIMEOUT -> {
                row.setApiResult(ApiResult.ERROR);
                row.setErrorCode(ErrorCode.CALL_TIMEOUT);
            }
        }
        checks.save(row);

        if (result.getStatus() == CallStatus.SUCCESS) {
            attempts.adoptResponseWhileDispatching(attemptId, result.getValue());
        }
        deferOnBackpressure(taskId, result);
    }

    /** Record one TERRAFORM_JOB poll observation (CHECK, RLE) — observed status mapped from the SUCCESS value. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordPoll(long taskId, long attemptId, String name, String handle, CallResult result) {
        recordObservation(taskId, attemptId, name, handle, result, classifyPoll(result));
    }

    /** Record one CONDITION_CHECK check observation (CHECK, RLE) — no attempt, no handle. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordCheck(long taskId, String name, CallResult result) {
        recordObservation(taskId, null, name, null, result, classifyCheck(result));
    }

    /**
     * Record one CHECK observation with RLE: an identical {@code (apiResult, observed, errorCode)} folds into
     * the open run (poll_count++, latency overwritten); a changed observation opens a new run. On backpressure,
     * defer {@code next_check_at}. One committed tx (callers are REQUIRES_NEW).
     */
    private void recordObservation(long taskId, @Nullable Long attemptId, String name, @Nullable String handle,
                                   CallResult result, Observation classified) {
        TaskCheck open = checks
                .findFirstByTaskIdAndKindAndNameAndExternalHandleOrderByStartedAtDescIdDesc(
                        taskId, CheckKind.CHECK, name, handle)
                .orElse(null);
        if (open != null && sameRun(open, classified)) {
            open.setCheckedAt(clock.instant());
            open.setPollCount(open.getPollCount() + 1);
            open.setLatencyMs(result.getLatencyMs()); // last poll's latency — overwrite, not accumulate (§1.2)
            checks.save(open);
        } else {
            checks.save(newRun(taskId, attemptId, name, handle, result, classified));
        }
        deferOnBackpressure(taskId, result);
    }

    /** Backpressure defers the next check to now + the (floor-applied) Retry-After carried on the result. */
    private void deferOnBackpressure(long taskId, CallResult result) {
        if (result.getStatus() == CallStatus.BACKPRESSURE && result.getRetryAfter() != null) {
            tasks.setNextCheckAt(taskId, clock.instant().plus(result.getRetryAfter()));
        }
    }

    private TaskCheck newRun(long taskId, @Nullable Long attemptId, String name, @Nullable String handle,
                             CallResult result, Observation classified) {
        Instant now = clock.instant();
        TaskCheck run = new TaskCheck();
        run.setTaskId(taskId);
        run.setAttemptId(attemptId); // TF poll: the owning attempt; null for CONDITION_CHECK
        run.setKind(CheckKind.CHECK);
        run.setName(name);
        run.setExternalHandle(handle);
        run.setApiResult(classified.apiResult());
        run.setObserved(classified.observed());
        run.setErrorCode(classified.errorCode());
        run.setPollCount(1);
        run.setStartedAt(now);
        run.setCheckedAt(now);
        run.setLatencyMs(result.getLatencyMs());
        return run;
    }

    private static boolean sameRun(TaskCheck open, Observation obs) {
        return open.getApiResult() == obs.apiResult()
                && open.getObserved() == obs.observed()
                && open.getErrorCode() == obs.errorCode();
    }

    /** TERRAFORM_JOB poll: SUCCESS → OK + observed status; BACKPRESSURE → (ERROR, null); REJECT → CHECK_ERROR. */
    private static Observation classifyPoll(CallResult result) {
        return switch (result.getStatus()) {
            case SUCCESS -> new Observation(ApiResult.OK, jobStatus(result.getValue()), null);
            case BACKPRESSURE -> new Observation(ApiResult.ERROR, null, null);
            case REJECT -> new Observation(ApiResult.ERROR, null, ErrorCode.CHECK_ERROR);
            case TIMEOUT -> new Observation(ApiResult.ERROR, null, ErrorCode.CALL_TIMEOUT);
        };
    }

    /** CONDITION_CHECK check: SUCCESS → OK + MET/NOT_MET; BACKPRESSURE → (ERROR, null); REJECT → CHECK_ERROR. */
    private static Observation classifyCheck(CallResult result) {
        return switch (result.getStatus()) {
            case SUCCESS -> new Observation(ApiResult.OK, conditionStatus(result.getValue()), null);
            case BACKPRESSURE -> new Observation(ApiResult.ERROR, null, null);
            case REJECT -> new Observation(ApiResult.ERROR, null, ErrorCode.CHECK_ERROR);
            case TIMEOUT -> new Observation(ApiResult.ERROR, null, ErrorCode.CALL_TIMEOUT);
        };
    }

    private static Observed jobStatus(String value) {
        return switch (value) {
            case "SUCCEEDED" -> Observed.SUCCEEDED;
            case "FAILED" -> Observed.FAILED;
            default -> Observed.RUNNING;
        };
    }

    private static Observed conditionStatus(String value) {
        return "MET".equals(value) ? Observed.MET : Observed.NOT_MET;
    }

    /** One classified CHECK observation — the RLE collapse key {@code (apiResult, observed, errorCode)}. */
    private record Observation(ApiResult apiResult, @Nullable Observed observed, @Nullable ErrorCode errorCode) {}
}
