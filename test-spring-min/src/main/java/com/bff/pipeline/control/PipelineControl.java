package com.bff.pipeline.control;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

/**
 * Admin cancel (minimal-redesign.md §2): a RUNNING pipeline and its non-terminal tasks go straight to CANCELLED
 * in one transaction — there is no intermediate CANCELLING state. Idempotent: a terminal pipeline is left as-is.
 * Applying cancel here (not via the reconciler) is also what closes the cancel race — once committed CANCELLED,
 * the reconciler skips the pipeline (it only services RUNNING).
 */
@Service
public class PipelineControl {

    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final Clock clock;

    public PipelineControl(PipelineRepository pipelines, TaskRepository tasks, Clock clock) {
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.clock = clock;
    }

    @Transactional
    public Pipeline cancel(Long pipelineId) {
        Pipeline pipeline = pipelines.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("no pipeline " + pipelineId));
        if (pipeline.getStatus().isTerminal()) {
            return pipeline; // idempotent
        }
        Instant now = clock.instant();
        for (Task task : tasks.findByPipelineIdOrderBySeqAsc(pipelineId)) {
            if (!task.getStatus().isTerminal()) {
                task.setStatus(TaskStatus.CANCELLED);
                task.setFinishedAt(now);
                tasks.save(task);
            }
        }
        pipeline.setStatus(PipelineStatus.CANCELLED);
        pipeline.setLastActivityAt(now);
        return pipelines.save(pipeline);
    }
}
