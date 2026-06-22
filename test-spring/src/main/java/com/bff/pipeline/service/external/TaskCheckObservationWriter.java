package com.bff.pipeline.service.external;
import com.bff.pipeline.dto.CheckObservationRecord;
import com.bff.pipeline.dto.DispatchCompletion;
import com.bff.pipeline.dto.TaskCheckObservation;

import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
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
     * Step 4: fill the pre-recorded DISPATCH row with the outcome, adopt the response on Accepted (write-once
     * CAS + late-response block), and on backpressure defer {@code next_check_at}. All one committed tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void completeDispatch(DispatchCompletion completion) {
        TerraformDispatchOutcome outcome = completion.getOutcome();
        TaskCheck row = checks.findById(completion.getCheckId())
                .orElseThrow(() -> new IllegalStateException("dispatch pre-record " + completion.getCheckId() + " missing"));
        row.setCheckedAt(clock.instant());
        row.setLatencyMs(completion.getLatencyMs());
        switch (outcome) {
            case TerraformDispatchOutcome.Accepted a -> {
                row.setApiResult(ApiResult.OK);
                row.setExternalHandle(a.getHandle());
            }
            // A hard reject carries error_code=IM_REJECTED on the observation so the NEXT tick can tell it
            // apart from the (ERROR, observed=null, error_code=null) backpressure marker — the async single
            // writer reads the committed row, not a return value (state-machine 114/115). The attempt is
            // ALSO closed IM_REJECTED by the tick (the row is the ledger; the attempt is the fail home).
            case TerraformDispatchOutcome.Rejected ignored -> {
                row.setApiResult(ApiResult.ERROR);
                row.setErrorCode(ErrorCode.IM_REJECTED);
            }
            case TerraformDispatchOutcome.Backpressure ignored -> row.setApiResult(ApiResult.ERROR); // (ERROR, null, null) marker
            case TerraformDispatchOutcome.CallTimeout ignored -> {
                row.setApiResult(ApiResult.ERROR);
                row.setErrorCode(ErrorCode.CALL_TIMEOUT);
            }
        }
        checks.save(row);

        if (outcome instanceof TerraformDispatchOutcome.Accepted a) {
            attempts.adoptResponseWhileDispatching(completion.getAttemptId(), a.getHandle());
        }
        if (completion.getBackpressureNextCheckAt() != null) {
            tasks.setNextCheckAt(completion.getTaskId(), completion.getBackpressureNextCheckAt());
        }
    }

    /**
     * Record one CHECK observation (TERRAFORM_JOB poll or CONDITION_CHECK check) with RLE: an identical
     * {@code (apiResult, observed, errorCode)} folds into the open run (poll_count++, latency overwritten);
     * a changed observation opens a new run. On backpressure, defer {@code next_check_at}. One committed tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordCheckObservation(CheckObservationRecord record) {
        TaskCheckObservation obs = record.getObservation();
        TaskCheck open = checks
                .findFirstByTaskIdAndKindAndNameAndExternalHandleOrderByStartedAtDescIdDesc(
                        record.getTaskId(), CheckKind.CHECK, record.getName(), record.getHandle())
                .orElse(null);
        if (open != null && sameRun(open, obs)) {
            open.setCheckedAt(clock.instant());
            open.setPollCount(open.getPollCount() + 1);
            open.setLatencyMs(record.getLatencyMs()); // last poll's latency — overwrite, not accumulate (§1.2)
            checks.save(open);
        } else {
            checks.save(newRun(record));
        }
        if (record.getBackpressureNextCheckAt() != null) {
            tasks.setNextCheckAt(record.getTaskId(), record.getBackpressureNextCheckAt());
        }
    }

    private TaskCheck newRun(CheckObservationRecord record) {
        TaskCheckObservation obs = record.getObservation();
        Instant now = clock.instant();
        TaskCheck run = new TaskCheck();
        run.setTaskId(record.getTaskId());
        run.setAttemptId(record.getAttemptId()); // TF poll: the owning attempt; null for CONDITION_CHECK
        run.setKind(CheckKind.CHECK);
        run.setName(record.getName());
        run.setExternalHandle(record.getHandle());
        run.setApiResult(obs.getApiResult());
        run.setObserved(obs.getObserved());
        run.setErrorCode(obs.getErrorCode());
        run.setPollCount(1);
        run.setStartedAt(now);
        run.setCheckedAt(now);
        run.setLatencyMs(record.getLatencyMs());
        return run;
    }

    private static boolean sameRun(TaskCheck open, TaskCheckObservation obs) {
        return open.getApiResult() == obs.getApiResult()
                && open.getObserved() == obs.getObserved()
                && open.getErrorCode() == obs.getErrorCode();
    }
}
