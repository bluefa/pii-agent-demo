package com.bff.pipeline.service.reconciler;
import com.bff.pipeline.service.external.ExternalCallLauncher;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.PipelineEventType;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
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
 * FIRED async through {@link ExternalCallLauncher} (D-T2 — the loop never blocks on the call); the call thread owns
 * task_check + attempt.response + the backpressure next_check_at. Every transition the tick makes is derived
 * from a COMMITTED observation read this tick — never from a call return value (D-T4 single writer): a call
 * fired this tick is read on a LATER tick. So each call-driven status (DISPATCHING/RUNNING/WAITING_EXTERNAL)
 * first reads the latest committed observation and transitions, then (only if still pending and due) fires
 * the next call.
 *
 * <p>Evaluation order per task: ① pipeline CANCELLING → cancel rules ▸ ② completed observation beats
 * ③ timeout ▸ ④ normal. The operation each call runs is fixed in the recipe ({@code task.operation}), so there
 * is no handler-resolve step. Every transition is a guarded CAS; the event + last_activity bump fire only when
 * the CAS changed a row.
 */
@Component
public class PipelineTaskAdvancer {

    private static final List<TaskStatus> SLOT_OCCUPYING = List.of(TaskStatus.DISPATCHING, TaskStatus.RUNNING);

    private final TaskRepository tasks;
    private final PipelineRepository pipelines;
    private final TaskAttemptRepository attempts;
    private final TaskCheckRepository checks;
    private final ExternalCallLauncher externalCalls;
    private final PipelineEventRecorder events;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public PipelineTaskAdvancer(TaskRepository tasks, PipelineRepository pipelines, TaskAttemptRepository attempts,
                        TaskCheckRepository checks, ExternalCallLauncher externalCalls,
                        PipelineEventRecorder events, PipelineEngineSettings settings, Clock clock) {
        this.tasks = tasks;
        this.pipelines = pipelines;
        this.attempts = attempts;
        this.checks = checks;
        this.externalCalls = externalCalls;
        this.events = events;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * One task, one tick — the "state transition tx" (Decision 6): the status/attempt/event/schedule writes
     * here commit together, while {@link ExternalCallLauncher} (REQUIRES_NEW) commits the observation independently.
     * Committing per task also makes the slotCap admission COUNT see the prior tasks' just-admitted slots.
     */
    @Transactional
    public void advance(TaskTick tick) {
        Pipeline pipeline = tick.getPipeline();
        Task task = tick.getTask();
        if (task.getStatus().isTerminal()) {
            return;
        }
        if (pipeline.getStatus() == PipelineStatus.CANCELLING) {
            cancel(tick);
            return;
        }
        switch (task.getStatus()) {
            case BLOCKED -> advanceBlocked(pipeline, task);
            case READY -> advanceReady(pipeline, task);
            case DISPATCHING -> advanceDispatching(tick);
            case RUNNING -> advanceRunning(tick);
            case WAITING_EXTERNAL -> advanceWaiting(tick);
            default -> { /* terminal handled above */ }
        }
    }

    // ---- forward (pipeline RUNNING) ----

    private void advanceBlocked(Pipeline pipeline, Task task) {
        if (predecessorDone(task) && tasks.casStatus(task.getId(), TaskStatus.BLOCKED, TaskStatus.READY) > 0) {
            onTransition(pipeline, task, transition(PipelineEventType.TASK_READY, Severity.INFO));
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
                onTransition(pipeline, task, transition(PipelineEventType.TASK_DISPATCHING, Severity.INFO));
            }
        } else if (tasks.casStatusStarting(task.getId(), TaskStatus.READY, TaskStatus.WAITING_EXTERNAL, now) > 0) {
            tasks.setDeadlineAt(task.getId(), now.plus(ttl(task)));
            tasks.setSchedule(task.getId(), now, now.plus(settings.getConditionPollingGuard()));
            onTransition(pipeline, task, transition(PipelineEventType.TASK_WAITING_EXTERNAL, Severity.INFO));
        }
    }

    private void advanceDispatching(TaskTick tick) {
        Pipeline pipeline = tick.getPipeline();
        Task task = tick.getTask();
        Instant now = clock.instant();
        TaskAttempt attempt = currentAttempt(task.getId());
        if (attempt == null) {
            return;
        }
        if (attempt.getResponse() != null) { // step 5: response adopted by the call-thread → RUNNING
            if (tasks.casStatus(task.getId(), TaskStatus.DISPATCHING, TaskStatus.RUNNING) > 0) {
                // Clear the dispatch in-flight park (next_check_at = fire + recoveryTimeout): make the task due
                // now so the FIRST job poll fires on the next tick at the job-poll cadence, not after recovery.
                tasks.setSchedule(task.getId(), now, now);
                onTransition(pipeline, task, transition(PipelineEventType.TASK_RUNNING, Severity.INFO));
            }
            return;
        }
        // Read the committed DISPATCH observation of THIS attempt. A hard reject (ERROR, error_code=IM_REJECTED)
        // fails the attempt now; backpressure (ERROR, null) and a single CALL_TIMEOUT (ERROR, CALL_TIMEOUT) hold
        // DISPATCHING and fall through to the time-based recovery / backoff re-dispatch below.
        TaskCheck lastDispatch = checks.findFirstByTaskIdAndKindAndAttemptIdOrderByStartedAtDescIdDesc(
                task.getId(), CheckKind.DISPATCH, attempt.getId()).orElse(null); // scoped to THIS attempt (clock-independent)
        if (lastDispatch != null && lastDispatch.getApiResult() == ApiResult.ERROR
                && lastDispatch.getErrorCode() == ErrorCode.IM_REJECTED) {
            failDispatch(TaskFailure.builder().pipeline(pipeline).task(task).attempt(attempt).reason(ErrorCode.IM_REJECTED).build());
            return;
        }
        // Recovery: response never persisted past the recovery timeout → fail the attempt (DISPATCH_NO_RESPONSE).
        // Suppressed ONLY while THIS attempt's last observation is the backpressure marker (ERROR, null) —
        // "later" is not "no response", so backpressure holds the same attempt and only the backoff re-dispatch
        // fires (state-machine 102/115). Reuses lastDispatch (already attempt-scoped) — no second query.
        boolean lastIsBackpressure = lastDispatch != null
                && lastDispatch.getApiResult() == ApiResult.ERROR && lastDispatch.getErrorCode() == null;
        boolean recoveryDue = !now.isBefore(attempt.getStartedAt().plus(settings.getDispatchRecoveryTimeout()));
        if (recoveryDue && !lastIsBackpressure) {
            failDispatch(TaskFailure.builder().pipeline(pipeline).task(task).attempt(attempt).reason(ErrorCode.DISPATCH_NO_RESPONSE).build());
            return;
        }
        if (tick.isDue()) { // fire the dispatch async (at-least-once; dispatch is idempotent), then defer re-evaluation
            // past the recovery window so an in-flight call is not re-fired — next_check_at is the dedup (not the
            // PENDING row), and a backpressure response pulls it back in sooner (call thread sets Retry-After).
            tasks.setSchedule(task.getId(), now, now.plus(settings.getDispatchRecoveryTimeout()));
            externalCalls.dispatch(task, attempt, pipeline.getTargetSourceId());
        }
    }

    private void advanceRunning(TaskTick tick) {
        pollJob(tick, false);
    }

    /**
     * One RUNNING TERRAFORM_JOB tick (also the CANCELLING drain). Read the latest committed poll observation of
     * the current attempt and act on a terminal one — SUCCEEDED → DONE, FAILED → JOB_FAILED — which BEATS the
     * execution timeout; otherwise, once a poll taken AT/AFTER the deadline still shows non-terminal, fail
     * EXECUTION_TIMEOUT (confirm-before-timeout, decision 4a); otherwise fire the next poll when due (or to
     * confirm a just-passed deadline), budget permitting. A poll read error / backpressure is NOT a job failure
     * — TERRAFORM_JOB poll never consumes fail_count (the job was not READ, not failed), so those observations
     * simply keep the job polling. {@code drain}=true (pipeline CANCELLING) closes a real failure terminally
     * with no requeue (forward edge gated, decision 4c).
     */
    private void pollJob(TaskTick tick, boolean drain) {
        Pipeline pipeline = tick.getPipeline();
        Task task = tick.getTask();
        Instant now = clock.instant();
        TaskAttempt attempt = currentAttempt(task.getId());
        if (attempt == null) {
            return; // invariant: a RUNNING task always has an attempt (created at admission); defensive
        }
        TaskCheck latest = latestCheckForAttempt(task.getId(), attempt);
        if (latest != null && latest.getObserved() == Observed.SUCCEEDED) {
            attempts.closeOk(attempt.getId(), now);
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.RUNNING, TaskStatus.DONE, now) > 0) {
                onTransition(pipeline, task, transition(PipelineEventType.TASK_DONE, Severity.INFO));
            }
            return;
        }
        if (latest != null && latest.getObserved() == Observed.FAILED) {
            runningFailure(TaskFailure.builder().pipeline(pipeline).task(task).attempt(attempt).reason(ErrorCode.JOB_FAILED).build(), now, drain); // beats timeout
            return;
        }
        // Execution timeout — only once a poll taken AT/AFTER the deadline still shows non-terminal; a
        // budget-starved tick defers (fires no confirming poll) rather than fail a possibly-finished job blind.
        boolean deadlinePassed = timedOut(task, now);
        if (deadlinePassed && polledPastDeadline(latest, task)) {
            runningFailure(TaskFailure.builder().pipeline(pipeline).task(task).attempt(attempt).reason(ErrorCode.EXECUTION_TIMEOUT).build(), now, drain);
            return;
        }
        if ((tick.isDue() || deadlinePassed) && tick.getBudget().tryConsume()) {
            tasks.setSchedule(task.getId(), now, now.plus(settings.getJobPollCadence()));
            externalCalls.poll(task, attempt, pipeline.getTargetSourceId());
        }
    }

    private void advanceWaiting(TaskTick tick) {
        Pipeline pipeline = tick.getPipeline();
        Task task = tick.getTask();
        Instant now = clock.instant();
        // CONDITION_CHECK fail_count is recomputed from the durable observation ledger before anything else —
        // see conditionFailedAtMax. Idempotent, so a fail that was observed (committed) but whose tick rolled
        // back is never lost and never double-counted → FAILED at maxFailCount.
        if (conditionFailedAtMax(pipeline, task, now)) {
            return;
        }
        // The latest committed check observation: MET → DONE (beats the TTL). A condition check has no
        // attempt/handle, so the latest CHECK run for the task IS the current observation.
        TaskCheck latest = checks.findFirstByTaskIdAndKindOrderByStartedAtDescIdDesc(task.getId(), CheckKind.CHECK).orElse(null);
        if (latest != null && latest.getObserved() == Observed.MET) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.WAITING_EXTERNAL, TaskStatus.DONE, now) > 0) {
                onTransition(pipeline, task, transition(PipelineEventType.TASK_DONE, Severity.INFO));
            }
            return;
        }
        // TTL — only once a check taken AT/AFTER the TTL still shows non-MET (confirm-before-EXPIRED).
        boolean ttlPassed = timedOut(task, now);
        if (ttlPassed && polledPastDeadline(latest, task)) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.WAITING_EXTERNAL, TaskStatus.EXPIRED, now) > 0) {
                onTransition(pipeline, task, transition(PipelineEventType.TASK_EXPIRED, Severity.CRITICAL)); // TTL_EXPIRED derived from status
            }
            return;
        }
        // Fire the next check when due (or to confirm a just-passed TTL), budget permitting. The tick sets the
        // ≥10m polling-guard cadence; the call thread overrides next_check_at only on backpressure (Retry-After).
        if ((tick.isDue() || ttlPassed) && tick.getBudget().tryConsume()) {
            tasks.setSchedule(task.getId(), now, now.plus(settings.getConditionPollingGuard()));
            externalCalls.check(task, pipeline.getTargetSourceId());
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
                onTransition(pipeline, task, transition(PipelineEventType.TASK_FAILED, Severity.CRITICAL));
            }
            return true;
        }
        return false;
    }

    // ---- failures shared by dispatch/run ----

    /** dispatch attempt failure (IM_REJECTED hard reject, or DISPATCH_NO_RESPONSE recovery): close + fail++. */
    private void failDispatch(TaskFailure failure) {
        Pipeline pipeline = failure.getPipeline();
        Task task = failure.getTask();
        TaskAttempt attempt = failure.getAttempt();
        Instant now = clock.instant();
        attempts.closeFailed(attempt.getId(), failure.getReason(), now);
        tasks.incrementFailCount(task.getId());
        if (task.getFailCount() + 1 >= task.getMaxFailCount()) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.DISPATCHING, TaskStatus.FAILED, now) > 0) {
                onTransition(pipeline, task, transition(PipelineEventType.TASK_FAILED, Severity.CRITICAL));
            }
        } else { // new attempt; stay DISPATCHING (slot held), re-dispatch on the next tick
            createAttempt(task.getId(), attempt.getAttemptNo() + 1, now);
            tasks.setDeadlineAt(task.getId(), now.plus(executionTimeout(task)));
            tasks.setSchedule(task.getId(), now, now); // due now → re-dispatch next tick
            onTransition(pipeline, task, transition(PipelineEventType.TASK_REDISPATCH, Severity.INFO));
        }
    }

    /** RUNNING real failure (JOB_FAILED / EXECUTION_TIMEOUT): close + fail++; FAILED at max, else requeue READY
     *  (slot released). {@code drain}=true (CANCELLING) terminates RUNNING→FAILED with no requeue. */
    private void runningFailure(TaskFailure failure, Instant now, boolean drain) {
        Pipeline pipeline = failure.getPipeline();
        Task task = failure.getTask();
        TaskAttempt attempt = failure.getAttempt();
        attempts.closeFailed(attempt.getId(), failure.getReason(), now);
        tasks.incrementFailCount(task.getId());
        if (drain || task.getFailCount() + 1 >= task.getMaxFailCount()) {
            if (tasks.casStatusTerminal(task.getId(), TaskStatus.RUNNING, TaskStatus.FAILED, now) > 0) {
                onTransition(pipeline, task, transition(PipelineEventType.TASK_FAILED, Severity.CRITICAL));
            }
        } else if (tasks.casStatus(task.getId(), TaskStatus.RUNNING, TaskStatus.READY) > 0) {
            onTransition(pipeline, task, transition(PipelineEventType.TASK_REQUEUE, Severity.INFO)); // slot released by leaving RUNNING
        }
    }

    // ---- cancel (pipeline CANCELLING) ----

    private void cancel(TaskTick tick) {
        Pipeline pipeline = tick.getPipeline();
        Task task = tick.getTask();
        Instant now = clock.instant();
        switch (task.getStatus()) {
            case BLOCKED, READY, WAITING_EXTERNAL -> cancelImmediate(pipeline, task, now); // undispatched / no in-flight job
            case DISPATCHING -> cancelDispatching(pipeline, task, now);
            case RUNNING -> drain(tick); // TF: drain the un-killable job to terminal
            default -> { /* terminal */ }
        }
    }

    private void cancelImmediate(Pipeline pipeline, Task task, Instant now) {
        if (tasks.casStatusTerminal(task.getId(), task.getStatus(), TaskStatus.CANCELLED, now) > 0) {
            onTransition(pipeline, task, transition(PipelineEventType.TASK_CANCELLED, Severity.INFO));
        }
    }

    private void cancelDispatching(Pipeline pipeline, Task task, Instant now) {
        TaskAttempt active = currentAttempt(task.getId());
        if (active != null && active.getFinishedAt() == null) {
            attempts.closeFailed(active.getId(), null, now); // action incomplete → outcome FAILED (status CANCELLED authoritative)
        }
        if (tasks.casStatusTerminal(task.getId(), TaskStatus.DISPATCHING, TaskStatus.CANCELLED, now) > 0) {
            onTransition(pipeline, task, transition(PipelineEventType.TASK_CANCELLED, Severity.INFO));
        }
    }

    /** CANCELLING drain of an un-killable RUNNING TF job: identical poll/observe/timeout logic as the normal
     *  RUNNING path, but {@code drain}=true so a real failure/timeout closes terminally with no requeue. */
    private void drain(TaskTick tick) {
        pollJob(tick, true);
    }

    // ---- helpers ----

    /** The latest CHECK observation of the current attempt — scoped by attempt id (clock-independent), so a
     *  prior attempt's stale FAILED/SUCCEEDED poll run is never re-consumed for a new attempt (no double-count). */
    private TaskCheck latestCheckForAttempt(Long taskId, TaskAttempt attempt) {
        return checks.findFirstByTaskIdAndKindAndAttemptIdOrderByStartedAtDescIdDesc(
                taskId, CheckKind.CHECK, attempt.getId()).orElse(null);
    }

    /** true once the current observation's last poll/check happened at/after the deadline — a fresh confirm
     *  that the job/condition did not reach a terminal observation before we declare a timeout/expiry. */
    private static boolean polledPastDeadline(TaskCheck latest, Task task) {
        return latest != null && latest.getCheckedAt() != null && task.getDeadlineAt() != null
                && !latest.getCheckedAt().isBefore(task.getDeadlineAt());
    }

    private boolean predecessorDone(Task task) {
        if (task.getSeq() == 0) {
            return true; // lowest-seq task has no predecessor → READY on the first tick
        }
        return tasks.findByPipelineIdAndSeq(task.getPipelineId(), task.getSeq() - 1)
                .map(t -> t.getStatus() == TaskStatus.DONE)
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

    private void onTransition(Pipeline pipeline, Task task, TaskTransition transition) {
        // a task transition refreshes the owning pipeline's board-sort key in the same tick.
        pipelines.touchActivity(pipeline.getId(), clock.instant());
        events.recordPipelineEvent(PipelineEvent.builder()
                .pipelineId(pipeline.getId())
                .taskId(task.getId())
                .type(transition.getType().wire())
                .severity(transition.getSeverity())
                .actor(Actor.SYSTEM)
                .build());
    }

    private static TaskTransition transition(PipelineEventType type, Severity severity) {
        return TaskTransition.builder().type(type).severity(severity).build();
    }
}
