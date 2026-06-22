package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.dto.PipelineEventRecord;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Derives {@code pipeline.status} from its tasks (state-machine §Pipeline) after a tick advances them. The
 * pipeline status is a by-product of the task states, except the user-driven RUNNING→CANCELLING (T5).
 *
 * <p>Precedence (state-machine 41-46): ① CANCELLING→CANCELLED when every task is terminal (beats a FAILED
 * task) ▸ ② a FAILED task ▸ ③ an EXPIRED task ▸ ④ all DONE. Each transition is a guarded CAS, so an
 * already-converged pipeline (0 rows) emits no duplicate event — same-tick / multi-replica safe.
 */
@Component
public class PipelineStatusDeriver {

    private final PipelineRepository pipelines;
    private final TaskAttemptRepository attempts;
    private final TaskCheckRepository checks;
    private final PipelineEventRecorder events;
    private final Clock clock;

    public PipelineStatusDeriver(PipelineRepository pipelines, TaskAttemptRepository attempts,
                           TaskCheckRepository checks, PipelineEventRecorder events, Clock clock) {
        this.pipelines = pipelines;
        this.attempts = attempts;
        this.checks = checks;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public void derive(Pipeline pipeline, List<Task> tasks) {
        Long id = pipeline.getId();
        Instant now = clock.instant();

        if (pipeline.getStatus() == PipelineStatus.CANCELLING) {
            if (allTerminal(tasks) && pipelines.casTerminal(id, PipelineStatus.CANCELLING, PipelineStatus.CANCELLED, now) > 0) {
                emit(id, "PIPELINE:CANCELLED", Severity.INFO);
            }
            return;
        }
        if (pipeline.getStatus() != PipelineStatus.RUNNING) {
            return;
        }

        Optional<Task> failed = firstWithStatus(tasks, TaskStatus.FAILED);
        if (failed.isPresent()) {
            convergeFailed(id, failed.get(), now);
            return;
        }
        Optional<Task> expired = firstWithStatus(tasks, TaskStatus.EXPIRED);
        if (expired.isPresent()) {
            convergeFailed(id, expired.get(), now);
            return;
        }
        if (!tasks.isEmpty() && tasks.stream().allMatch(t -> t.getStatus() == TaskStatus.DONE)
                && pipelines.casTerminal(id, PipelineStatus.RUNNING, PipelineStatus.DONE, now) > 0) {
            emit(id, "PIPELINE:DONE", Severity.INFO);
        }
    }

    private void convergeFailed(Long pipelineId, Task task, Instant now) {
        if (pipelines.casStatusWithFailReason(
                pipelineId, PipelineStatus.RUNNING, PipelineStatus.FAILED, task.getId(), failReason(task), now) > 0) {
            emit(pipelineId, "PIPELINE:FAILED", Severity.CRITICAL);
        }
    }

    /**
     * The failing task's canonical errorCode (api §0 source rule): EXPIRED → TTL_EXPIRED; else the latest
     * attempt's errorCode (TF: IM_REJECTED/DISPATCH_NO_RESPONSE/JOB_FAILED/EXECUTION_TIMEOUT); else the
     * latest task_check's errorCode (HANDLER_NOT_FOUND, or CONDITION_CHECK CHECK_ERROR/CALL_TIMEOUT).
     */
    @Nullable
    private ErrorCode failReason(Task task) {
        if (task.getStatus() == TaskStatus.EXPIRED) {
            return ErrorCode.TTL_EXPIRED;
        }
        ErrorCode fromAttempt = attempts.findFirstByTaskIdOrderByAttemptNoDesc(task.getId())
                .map(TaskAttempt::getErrorCode).orElse(null);
        if (fromAttempt != null) {
            return fromAttempt;
        }
        return checks.findFirstByTaskIdOrderByStartedAtDescIdDesc(task.getId())
                .map(TaskCheck::getErrorCode).orElse(null);
    }

    private static Optional<Task> firstWithStatus(List<Task> tasks, TaskStatus status) {
        return tasks.stream().filter(t -> t.getStatus() == status).findFirst();
    }

    private static boolean allTerminal(List<Task> tasks) {
        return !tasks.isEmpty() && tasks.stream().allMatch(t -> t.getStatus().isTerminal());
    }

    private void emit(Long pipelineId, String type, Severity severity) {
        events.recordPipelineEvent(PipelineEventRecord.builder()
                .pipelineId(pipelineId).type(type).severity(severity).actor(Actor.SYSTEM).build());
    }
}
