package com.bff.pipeline.reconciler;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskAttempt;
import com.bff.pipeline.domain.TaskCheck;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.handler.CheckOutcome;
import com.bff.pipeline.handler.ConditionCheckHandler;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.handler.PipelineHandler;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.bff.pipeline.service.EventRecorder;
import com.bff.pipeline.service.ExternalCalls;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Advances ONE task one tick — the single-writer state machine (state-machine §Task, orchestrator §1.1).
 * The tick owns task/attempt STATUS, fail_count, attempt lifecycle (create on dispatch, close on terminal),
 * pipeline_event, and the normal schedule (next_check_at/last_checked_at/deadline_at). External calls are
 * fired through {@link ExternalCalls} (the call-thread, which owns task_check + attempt.response +
 * backpressure next_check_at); the tick acts on the RETURNED outcome.
 *
 * <p>Evaluation order per task: ① pipeline CANCELLING → cancel rules ▸ ② handler resolve (serviceable task,
 * miss → immediate FAILED + synthetic task_check) ▸ ③ completed observation beats ④ timeout ▸ ⑤ normal.
 * Every transition is a guarded CAS; the event + last_activity bump fire only when the CAS changed a row.
 */
@Component
public class TaskAdvancer {

    private static final List<TaskStatus> SLOT_OCCUPYING = List.of(TaskStatus.DISPATCHING, TaskStatus.RUNNING);

    private final TaskRepository tasks;
    private final PipelineRepository pipelines;
    private final TaskAttemptRepository attempts;
    private final TaskCheckRepository checks;
    private final HandlerRegistry registry;
    private final ExternalCalls externalCalls;
    private final EventRecorder events;
    private final PipelineSettings settings;
    private final Clock clock;

    public TaskAdvancer(TaskRepository tasks, PipelineRepository pipelines, TaskAttemptRepository attempts,
                        TaskCheckRepository checks, HandlerRegistry registry, ExternalCalls externalCalls,
                        EventRecorder events, PipelineSettings settings, Clock clock) {
        this.tasks = tasks;
        this.pipelines = pipelines;
        this.attempts = attempts;
        this.checks = checks;
        this.registry = registry;
        this.externalCalls = externalCalls;
        this.events = events;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * One task, one tick — the "state transition tx" (Decision 6): the status/attempt/event/schedule writes
     * here commit together, while {@link ExternalCalls} (REQUIRES_NEW) commits the observation independently.
     * Committing per task also makes the slotCap admission COUNT see the prior tasks' just-admitted slots.
     */
    @Transactional
    public void advance(Pipeline pipeline, Task task, boolean due, TickBudget budget) {
        if (task.getStatus().isTerminal()) {
            return;
        }
        if (pipeline.getStatus() == PipelineStatus.CANCELLING) {
            cancel(pipeline, task, due, budget);
            return;
        }
        PipelineHandler handler = registry.find(task.getHandlerKey()).orElse(null);
        if (handler == null && task.getStatus() != TaskStatus.BLOCKED) {
            failHandlerNotFound(pipeline, task);
            return;
        }
        switch (task.getStatus()) {
            case BLOCKED -> advanceBlocked(pipeline, task);
            case READY -> advanceReady(pipeline, task);
            case DISPATCHING -> advanceDispatching(pipeline, task, (TerraformJobHandler) handler, due);
            case RUNNING -> advanceRunning(pipeline, task, (TerraformJobHandler) handler, due, budget);
            case WAITING_EXTERNAL -> advanceWaiting(pipeline, task, (ConditionCheckHandler) handler, due, budget);
            default -> { /* terminal handled above */ }
        }
    }

    // ---- forward (pipeline RUNNING) ----

    private void advanceBlocked(Pipeline pipeline, Task task) {
        if (predecessorDone(task) && tasks.casStatus(task.getId(), TaskStatus.BLOCKED, TaskStatus.READY) > 0) {
            onTransition(pipeline, task, "TASK:READY", Severity.INFO);
        }
    }

    /**
     * READY → DISPATCHING (admit) or → WAITING_EXTERNAL — the transition only. The dispatch / first check
     * fires on the NEXT tick from the DISPATCHING / WAITING_EXTERNAL handler, after this transition has
     * committed, so the call-thread's response adoption observes a committed DISPATCHING (§3.1 step 1 → 2).
     */
    private void advanceReady(Pipeline pipeline, Task task) {
        Instant now = clock.instant();
        if (task.getKind() == TaskKind.TERRAFORM_JOB) {
            if (tasks.countByKindAndStatusIn(TaskKind.TERRAFORM_JOB, SLOT_OCCUPYING) >= settings.getSlotCap()) {
                return; // slot queue: stay READY (no separate WAITING_SLOT state)
            }
            if (tasks.casStatusStarting(task.getId(), TaskStatus.READY, TaskStatus.DISPATCHING, now) > 0) {
                createAttempt(task.getId(), 1, now);
                tasks.setDeadlineAt(task.getId(), now.plus(executionTimeout(task)));
                tasks.setSchedule(task.getId(), now, now); // due now → dispatch fires next tick
                onTransition(pipeline, task, "TASK:DISPATCHING", Severity.INFO);
            }
        } else if (tasks.casStatusStarting(task.getId(), TaskStatus.READY, TaskStatus.WAITING_EXTERNAL, now) > 0) {
            tasks.setDeadlineAt(task.getId(), now.plus(ttl(task)));
            tasks.setSchedule(task.getId(), now, now.plus(settings.getConditionPollingGuard()));
            onTransition(pipeline, task, "TASK:WAITING_EXTERNAL", Severity.INFO);
        }
    }

    private void advanceDispatching(Pipeline pipeline, Task task, TerraformJobHandler handler, boolean due) {
        Instant now = clock.instant();
        TaskAttempt attempt = currentAttempt(task.getId());
        if (attempt == null) {
            return;
        }
        if (attempt.getResponse() != null) { // step 5: response adopted by the call-thread
            if (tasks.casStatus(task.getId(), TaskStatus.DISPATCHING, TaskStatus.RUNNING) > 0) {
                onTransition(pipeline, task, "TASK:RUNNING", Severity.INFO);
            }
            return;
        }
        // Recovery: response never persisted past the recovery timeout → fail the attempt. The backpressure
        // exception (last DISPATCH observation = 429/503 = the (ERROR,null) marker) suppresses ONLY this fail,
        // NEVER the re-dispatch — backpressure already deferred next_check_at, so the task simply is not due
        // yet. (A hard reject writes the same (ERROR,null) row but is handled synchronously by the returned
        // outcome, so it must not also block the next attempt's re-dispatch — that was the stall bug.)
        boolean recoveryDue = !now.isBefore(attempt.getStartedAt().plus(settings.getDispatchRecoveryTimeout()));
        if (recoveryDue && !isLastDispatchBackpressure(task.getId())) {
            failDispatch(pipeline, task, attempt, ErrorCode.DISPATCH_NO_RESPONSE);
            return;
        }
        if (due) { // (re-)fire dispatch when due (at-least-once; dispatch is idempotent)
            handleDispatchOutcome(pipeline, task, attempt,
                    externalCalls.dispatch(task, attempt, handler, pipeline.getTargetSourceId()));
        }
    }

    private void handleDispatchOutcome(Pipeline pipeline, Task task, TaskAttempt attempt, DispatchOutcome outcome) {
        // Accepted/Backpressure/CallTimeout: leave DISPATCHING (next tick → RUNNING on response, or recovery).
        // Backpressure vs hard reject is distinguished here by the RETURNED outcome (the rows are identical).
        if (outcome instanceof DispatchOutcome.Rejected) {
            failDispatch(pipeline, task, attempt, ErrorCode.IM_REJECTED);
        }
    }

    private void advanceRunning(Pipeline pipeline, Task task, TerraformJobHandler handler, boolean due, TickBudget budget) {
        Instant now = clock.instant();
        TaskAttempt attempt = currentAttempt(task.getId());
        if (attempt == null) {
            return; // invariant: a RUNNING task always has an attempt (created at admission); defensive
        }
        boolean deadlinePassed = timedOut(task, now);
        // Poll when due OR when the deadline has passed — a fresh poll must confirm the job did NOT already
        // SUCCEED before we declare an execution timeout (completed observation beats timeout). With the budget
        // spent we DEFER rather than fail a possibly-finished job blind. The returned value IS the just-committed
        // observation; one poll per tick = at most one fail_count (per-call accounting the fail matrix needs);
        // a rolled-back terminal self-heals since the next tick re-polls the still-SUCCEEDED job (terminal-once).
        if ((due || deadlinePassed) && budget.tryConsume()) {
            PollOutcome outcome = externalCalls.poll(task, attempt, handler, pipeline.getTargetSourceId());
            if (applyPoll(pipeline, task, attempt, outcome, now)) {
                return; // SUCCEEDED → DONE / FAILED → fail (beats timeout)
            }
            if (deadlinePassed) {
                runningFailure(pipeline, task, attempt, ErrorCode.EXECUTION_TIMEOUT, now, false);
            }
        }
    }

    /** @return true if a terminal/requeue transition fired (so the caller skips the timeout check). */
    private boolean applyPoll(Pipeline pipeline, Task task, TaskAttempt attempt, PollOutcome outcome, Instant now) {
        return switch (outcome) {
            case PollOutcome.Status status -> switch (status.observed()) {
                case SUCCEEDED -> {
                    attempts.closeOk(attempt.getId(), now);
                    if (tasks.casStatusTerminal(task.getId(), TaskStatus.RUNNING, TaskStatus.DONE, now) > 0) {
                        onTransition(pipeline, task, "TASK:DONE", Severity.INFO);
                    }
                    yield true;
                }
                case FAILED -> {
                    runningFailure(pipeline, task, attempt, ErrorCode.JOB_FAILED, now, false);
                    yield true;
                }
                default -> { // RUNNING: keep polling, no fail
                    tasks.setSchedule(task.getId(), now, now.plus(settings.getJobPollCadence()));
                    yield false;
                }
            };
            // poll read error (CHECK_ERROR/CALL_TIMEOUT) = job not read ≠ job failed → no fail, keep polling.
            case PollOutcome.CallFailed ignored -> {
                tasks.setSchedule(task.getId(), now, now.plus(settings.getJobPollCadence()));
                yield false;
            }
            case PollOutcome.Backpressure ignored -> false; // call-thread set next_check_at; no fail
        };
    }

    private void advanceWaiting(Pipeline pipeline, Task task, ConditionCheckHandler handler, boolean due, TickBudget budget) {
        Instant now = clock.instant();
        // CONDITION_CHECK fail_count is recomputed from the durable observation ledger before anything else —
        // see conditionFailedAtMax. This recovers a fail that was observed (committed) but whose tick rolled
        // back, so a committed failed call is never lost and never double-counted.
        if (conditionFailedAtMax(pipeline, task, now)) {
            return;
        }
        boolean ttlPassed = timedOut(task, now);
        // Check when due OR when the TTL has passed — a fresh check must confirm the condition is not already
        // MET before declaring EXPIRED (completed observation beats timeout); with no budget, defer.
        if ((due || ttlPassed) && budget.tryConsume()) {
            CheckOutcome outcome = externalCalls.check(task, handler, pipeline.getTargetSourceId());
            if (outcome instanceof CheckOutcome.Condition met && met.observed() == Observed.MET) {
                if (tasks.casStatusTerminal(task.getId(), TaskStatus.WAITING_EXTERNAL, TaskStatus.DONE, now) > 0) {
                    onTransition(pipeline, task, "TASK:DONE", Severity.INFO);
                }
                return;
            }
            if (outcome instanceof CheckOutcome.CallFailed && conditionFailedAtMax(pipeline, task, now)) {
                return; // this call pushed the durable failure count to maxFailCount → FAILED
            }
            if (!(outcome instanceof CheckOutcome.Backpressure)) { // NOT_MET or a sub-max error → keep polling
                tasks.setSchedule(task.getId(), now, now.plus(settings.getConditionPollingGuard()));
            }
            if (ttlPassed && tasks.casStatusTerminal(task.getId(), TaskStatus.WAITING_EXTERNAL, TaskStatus.EXPIRED, now) > 0) {
                onTransition(pipeline, task, "TASK:EXPIRED", Severity.CRITICAL); // TTL_EXPIRED derived from status
            }
        }
    }

    /**
     * Recompute CONDITION_CHECK fail_count from the durable CHECK error ledger (sum of non-backpressure error
     * calls) and FAIL the task if it reached maxFailCount. Idempotent (a recompute, not a ++), so it is the
     * rollback-safe accounting: a committed failed call that lost its tick still counts on the next tick.
     *
     * @return true if the task reached maxFailCount and was FAILED.
     */
    private boolean conditionFailedAtMax(Pipeline pipeline, Task task, Instant now) {
        int failures = (int) checks.sumConditionCheckFailures(task.getId());
        tasks.setFailCount(task.getId(), failures);
        if (failures >= task.getMaxFailCount()) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.WAITING_EXTERNAL, TaskStatus.FAILED, now) > 0) {
                onTransition(pipeline, task, "TASK:FAILED", Severity.CRITICAL);
            }
            return true;
        }
        return false;
    }

    // ---- failures shared by dispatch/run ----

    /** dispatch attempt failure (IM_REJECTED hard reject, or DISPATCH_NO_RESPONSE recovery): close + fail++. */
    private void failDispatch(Pipeline pipeline, Task task, TaskAttempt attempt, ErrorCode reason) {
        Instant now = clock.instant();
        attempts.closeFailed(attempt.getId(), reason, now);
        tasks.incrementFailCount(task.getId());
        if (task.getFailCount() + 1 >= task.getMaxFailCount()) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.DISPATCHING, TaskStatus.FAILED, now) > 0) {
                onTransition(pipeline, task, "TASK:FAILED", Severity.CRITICAL);
            }
        } else { // new attempt; stay DISPATCHING (slot held), re-dispatch on the next tick
            createAttempt(task.getId(), attempt.getAttemptNo() + 1, now);
            tasks.setDeadlineAt(task.getId(), now.plus(executionTimeout(task)));
            tasks.setSchedule(task.getId(), now, now); // due now → re-dispatch next tick
            onTransition(pipeline, task, "TASK:REDISPATCH", Severity.INFO);
        }
    }

    /** RUNNING real failure (JOB_FAILED / EXECUTION_TIMEOUT): close + fail++; FAILED at max, else requeue READY
     *  (slot released). {@code drain}=true (CANCELLING) terminates RUNNING→FAILED with no requeue. */
    private void runningFailure(Pipeline pipeline, Task task, TaskAttempt attempt, ErrorCode reason, Instant now, boolean drain) {
        attempts.closeFailed(attempt.getId(), reason, now);
        tasks.incrementFailCount(task.getId());
        if (drain || task.getFailCount() + 1 >= task.getMaxFailCount()) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.RUNNING, TaskStatus.FAILED, now) > 0) {
                onTransition(pipeline, task, "TASK:FAILED", Severity.CRITICAL);
            }
        } else if (tasks.casStatus(task.getId(), TaskStatus.RUNNING, TaskStatus.READY) > 0) {
            onTransition(pipeline, task, "TASK:REQUEUE", Severity.INFO); // slot released by leaving RUNNING
        }
    }

    private void failHandlerNotFound(Pipeline pipeline, Task task) {
        Instant now = clock.instant();
        checks.save(syntheticHandlerNotFound(task.getId(), now));
        TaskAttempt active = currentAttempt(task.getId());
        if (active != null && active.getFinishedAt() == null
                && (task.getStatus() == TaskStatus.DISPATCHING || task.getStatus() == TaskStatus.RUNNING)) {
            // close the in-flight attempt with no error_code — the cause lives on the synthetic task_check
            attempts.closeFailed(active.getId(), null, now);
        }
        if (tasks.casStatusTerminal(task.getId(), task.getStatus(), TaskStatus.FAILED, now) > 0) {
            onTransition(pipeline, task, "TASK:FAILED", Severity.CRITICAL);
        }
    }

    // ---- cancel (pipeline CANCELLING) ----

    private void cancel(Pipeline pipeline, Task task, boolean due, TickBudget budget) {
        Instant now = clock.instant();
        switch (task.getStatus()) {
            case BLOCKED, READY, WAITING_EXTERNAL -> cancelImmediate(pipeline, task, now); // undispatched / no in-flight job
            case DISPATCHING -> cancelDispatching(pipeline, task, now);
            case RUNNING -> drain(pipeline, task, due, budget, now); // TF: drain the un-killable job to terminal
            default -> { /* terminal */ }
        }
    }

    private void cancelImmediate(Pipeline pipeline, Task task, Instant now) {
        if (tasks.casStatusTerminal(task.getId(), task.getStatus(), TaskStatus.CANCELLED, now) > 0) {
            onTransition(pipeline, task, "TASK:CANCELLED", Severity.INFO);
        }
    }

    private void cancelDispatching(Pipeline pipeline, Task task, Instant now) {
        TaskAttempt active = currentAttempt(task.getId());
        if (active != null && active.getFinishedAt() == null) {
            attempts.closeFailed(active.getId(), null, now); // action incomplete → outcome FAILED (status CANCELLED authoritative)
        }
        if (tasks.casStatusTerminal(task.getId(), TaskStatus.DISPATCHING, TaskStatus.CANCELLED, now) > 0) {
            onTransition(pipeline, task, "TASK:CANCELLED", Severity.INFO);
        }
    }

    private void drain(Pipeline pipeline, Task task, boolean due, TickBudget budget, Instant now) {
        TerraformJobHandler handler = (TerraformJobHandler) registry.find(task.getHandlerKey()).orElse(null);
        if (handler == null) {
            return; // can't poll; the orphan job ends on its own — leave RUNNING until handler returns
        }
        TaskAttempt attempt = currentAttempt(task.getId());
        boolean deadlinePassed = timedOut(task, now);
        // Same confirm-before-timeout rule as the normal RUNNING path (P1): a fresh poll must confirm the job
        // did not already SUCCEED before we declare an execution timeout, and a budget-starved tick defers
        // rather than fail a possibly-finished drain.
        if ((due || deadlinePassed) && budget.tryConsume()) {
            PollOutcome outcome = externalCalls.poll(task, attempt, handler, pipeline.getTargetSourceId());
            if (applyDrainPoll(pipeline, task, attempt, outcome, now)) {
                return; // SUCCEEDED → DONE / FAILED → FAILED (beats timeout)
            }
            if (deadlinePassed) {
                runningFailure(pipeline, task, attempt, ErrorCode.EXECUTION_TIMEOUT, now, true);
            }
        }
    }

    /** Drain poll: SUCCEEDED→DONE, FAILED→FAILED (real, no requeue — forward edge gated); else keep polling. */
    private boolean applyDrainPoll(Pipeline pipeline, Task task, TaskAttempt attempt, PollOutcome outcome, Instant now) {
        if (outcome instanceof PollOutcome.Status status) {
            if (status.observed() == Observed.SUCCEEDED) {
                attempts.closeOk(attempt.getId(), now);
                if (tasks.casStatusTerminal(task.getId(), TaskStatus.RUNNING, TaskStatus.DONE, now) > 0) {
                    onTransition(pipeline, task, "TASK:DONE", Severity.INFO);
                }
                return true;
            }
            if (status.observed() == Observed.FAILED) {
                runningFailure(pipeline, task, attempt, ErrorCode.JOB_FAILED, now, true);
                return true;
            }
        }
        tasks.setSchedule(task.getId(), now, now.plus(settings.getJobPollCadence()));
        return false;
    }

    // ---- helpers ----

    private boolean predecessorDone(Task task) {
        if (task.getSeq() == 0) {
            return true; // lowest-seq task has no predecessor → READY on the first tick
        }
        return tasks.findByPipelineIdAndSeq(task.getPipelineId(), task.getSeq() - 1)
                .map(t -> t.getStatus() == TaskStatus.DONE)
                .orElse(false);
    }

    private boolean isLastDispatchBackpressure(Long taskId) {
        return checks.findFirstByTaskIdAndKindOrderByStartedAtDescIdDesc(taskId, CheckKind.DISPATCH)
                .map(c -> c.getApiResult() == ApiResult.ERROR && c.getErrorCode() == null)
                .orElse(false);
    }

    private boolean timedOut(Task task, Instant now) {
        return task.getDeadlineAt() != null && !now.isBefore(task.getDeadlineAt());
    }

    private TaskAttempt currentAttempt(Long taskId) {
        return attempts.findFirstByTaskIdOrderByAttemptNoDesc(taskId).orElse(null);
    }

    private TaskAttempt createAttempt(Long taskId, int attemptNo, Instant now) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(taskId);
        attempt.setAttemptNo(attemptNo);
        attempt.setStartedAt(now);
        return attempts.save(attempt);
    }

    private Duration executionTimeout(Task task) {
        return task.getExecutionTimeout() != null ? task.getExecutionTimeout() : settings.getExecutionTimeout();
    }

    private Duration ttl(Task task) {
        return task.getTtl() != null ? task.getTtl() : settings.getWaitExternalTtl();
    }

    private TaskCheck syntheticHandlerNotFound(Long taskId, Instant now) {
        TaskCheck row = new TaskCheck();
        row.setTaskId(taskId);
        row.setKind(CheckKind.CHECK);
        row.setName("orchestrator.handler.resolve");
        row.setApiResult(ApiResult.ERROR);
        row.setErrorCode(ErrorCode.HANDLER_NOT_FOUND);
        row.setPollCount(1);
        row.setStartedAt(now);
        row.setCheckedAt(now);
        return row;
    }

    private void onTransition(Pipeline pipeline, Task task, String type, Severity severity) {
        // a task transition refreshes the owning pipeline's board-sort key in the same tick.
        pipelines.touchActivity(pipeline.getId(), clock.instant());
        events.recordPipelineEvent(pipeline.getId(), task.getId(), type, severity, Actor.SYSTEM, null);
    }
}
