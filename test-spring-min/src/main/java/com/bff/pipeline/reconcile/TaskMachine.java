package com.bff.pipeline.reconcile;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.im.ImCall;
import com.bff.pipeline.im.ImClient;
import com.bff.pipeline.im.TerraformPoll;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Advances ONE task one step — the state machine of minimal-redesign.md §2/§3, read top to bottom:
 *
 * <pre>
 *   READY        → dispatch (synchronous, idempotent) → IN_PROGRESS
 *   IN_PROGRESS  → poll:
 *                    TERRAFORM_JOB  : SUCCEEDED → DONE; FAILED → retry-or-fail; past executionTimeout → retry-or-fail(TIMEOUT)
 *                    CONDITION_CHECK: met → DONE; not met → reschedule; past ttl → FAILED(TTL_EXPIRED)
 * </pre>
 *
 * The task row is the only state. {@code fail_count} is incremented only on the branch that actually fails (so
 * a re-run never double-counts), and a call that throws or times out is a retriable failure (CHECK_ERROR /
 * CALL_TIMEOUT). Re-dispatch is idempotent (O28), so a crash mid-dispatch is recovered by simply dispatching
 * again on the next tick.
 */
@Component
public class TaskMachine {

    private final ImClient im;
    private final ImCall imCall;
    private final TaskRepository tasks;
    private final PipelineSettings settings;
    private final Clock clock;

    public TaskMachine(ImClient im, ImCall imCall, TaskRepository tasks, PipelineSettings settings, Clock clock) {
        this.im = im;
        this.imCall = imCall;
        this.tasks = tasks;
        this.settings = settings;
        this.clock = clock;
    }

    void advance(String target, Task task) {
        switch (task.getStatus()) {
            case READY -> dispatch(target, task);
            case IN_PROGRESS -> poll(target, task);
            default -> { /* terminal — not serviced */ }
        }
    }

    // ---- READY → IN_PROGRESS ----

    private void dispatch(String target, Task task) {
        if (task.getKind() == TaskKind.TERRAFORM_JOB) {
            String jobId;
            try {
                jobId = imCall.withTimeout(() -> im.runTerraform(target, task.getOperation()));
            } catch (ImCall.CallTimeoutException e) {
                retryOrFail(task, ErrorCode.CALL_TIMEOUT);
                return;
            } catch (RuntimeException e) {
                retryOrFail(task, ErrorCode.CHECK_ERROR);
                return;
            }
            task.setJobId(jobId); // idempotent: a crash before this is recovered by re-dispatch (O28)
        }
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setStartedAt(clock.instant());
        task.setNextCheckAt(clock.instant());
        tasks.save(task);
    }

    // ---- IN_PROGRESS → DONE | retry | FAILED ----

    private void poll(String target, Task task) {
        if (task.getKind() == TaskKind.TERRAFORM_JOB) {
            pollTerraform(task);
        } else {
            pollCondition(target, task);
        }
    }

    private void pollTerraform(Task task) {
        TerraformPoll poll;
        try {
            poll = imCall.withTimeout(() -> im.terraformJobStatus(task.getJobId()));
        } catch (ImCall.CallTimeoutException e) {
            retryOrFail(task, ErrorCode.CALL_TIMEOUT);
            return;
        } catch (RuntimeException e) {
            retryOrFail(task, ErrorCode.CHECK_ERROR);
            return;
        }
        if (poll.finished()) {
            if (poll.succeeded()) {
                complete(task);
            } else {
                retryOrFail(task, ErrorCode.JOB_FAILED);
            }
            return;
        }
        if (pastDeadline(task, executionTimeout(task))) {
            retryOrFail(task, ErrorCode.EXECUTION_TIMEOUT);
            return;
        }
        reschedule(task, settings.getTickInterval()); // still running — poll again next tick
    }

    private void pollCondition(String target, Task task) {
        boolean met;
        try {
            met = imCall.withTimeout(() -> im.checkCondition(target, task.getOperation()));
        } catch (ImCall.CallTimeoutException e) {
            retryOrFail(task, ErrorCode.CALL_TIMEOUT);
            return;
        } catch (RuntimeException e) {
            retryOrFail(task, ErrorCode.CHECK_ERROR);
            return;
        }
        if (met) {
            complete(task);
            return;
        }
        if (pastDeadline(task, ttl(task))) {
            fail(task, ErrorCode.TTL_EXPIRED); // a condition that never meets its ttl is terminal, no retry
            return;
        }
        reschedule(task, pollingInterval(task)); // not met — check again after the polling cadence
    }

    // ---- terminal / retry transitions ----

    private void complete(Task task) {
        task.setStatus(TaskStatus.DONE);
        task.setFinishedAt(clock.instant());
        tasks.save(task);
    }

    /** A failed dispatch/poll: count it, then re-dispatch a fresh run while under maxFailCount, else FAIL. */
    private void retryOrFail(Task task, ErrorCode reason) {
        task.setFailCount(task.getFailCount() + 1);
        if (task.getFailCount() >= maxFailCount(task)) {
            fail(task, reason);
        } else {
            task.setStatus(TaskStatus.READY); // fresh re-dispatch next tick (idempotent)
            task.setReadyAt(clock.instant());
            task.setJobId(null);
            tasks.save(task);
        }
    }

    private void fail(Task task, ErrorCode reason) {
        task.setStatus(TaskStatus.FAILED);
        task.setErrorCode(reason);
        task.setFinishedAt(clock.instant());
        tasks.save(task);
    }

    private void reschedule(Task task, Duration after) {
        task.setNextCheckAt(clock.instant().plus(after));
        tasks.save(task);
    }

    // ---- deadlines + per-task knob fallback to the global settings ----

    private boolean pastDeadline(Task task, Duration deadline) {
        return task.getStartedAt() != null && !clock.instant().isBefore(task.getStartedAt().plus(deadline));
    }

    private Duration executionTimeout(Task task) {
        return task.getExecutionTimeout() != null ? task.getExecutionTimeout() : settings.getExecutionTimeout();
    }

    private Duration ttl(Task task) {
        return task.getTtl() != null ? task.getTtl() : settings.getTtl();
    }

    private Duration pollingInterval(Task task) {
        return task.getPollingInterval() != null ? task.getPollingInterval() : settings.getPollingInterval();
    }

    private int maxFailCount(Task task) {
        return task.getMaxFailCount() != null ? task.getMaxFailCount() : settings.getMaxFailCount();
    }
}
