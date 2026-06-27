package com.bff.pipeline.reconcile;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

/**
 * Reconciles ONE pipeline in its own committed transaction (minimal-redesign.md §3). Split out from
 * {@link Reconciler} so the {@code @Transactional} boundary is a real proxied call — the tick invokes this
 * through the Spring proxy, so each pipeline's advance + converge commits (or rolls back) on its own.
 *
 * <p>Cancel-race guard: the transaction RE-READS the pipeline first and skips a non-RUNNING one; and because
 * {@code Task} is {@code @Version}-locked while {@code finish()} is a RUNNING-guarded CAS, a cancel that commits
 * DURING the (synchronous) IM call makes this reconcile's stale task save / pipeline finish a no-op or a
 * rejected write rather than clobbering CANCELLED.
 */
@Component
public class PipelineReconciliation {

    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final TaskMachine machine;
    private final Clock clock;

    public PipelineReconciliation(PipelineRepository pipelines, TaskRepository tasks, TaskMachine machine, Clock clock) {
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.machine = machine;
        this.clock = clock;
    }

    @Transactional
    public void reconcile(Long pipelineId) {
        Pipeline pipeline = pipelines.findById(pipelineId).orElse(null);
        if (pipeline == null || pipeline.getStatus() != PipelineStatus.RUNNING) {
            return; // cancelled / already converged between the scan and now
        }
        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipelineId);
        Task current = currentTask(chain);
        if (current != null && isDue(current)) {
            machine.advance(pipeline.getTarget(), current); // makes the IM call; the @Version save rejects a stale write
        }
        converge(pipelineId);
    }

    /** The current task is the lowest-seq non-terminal one; higher-seq tasks are "blocked" only by not being it. */
    private Task currentTask(List<Task> chain) {
        return chain.stream().filter(t -> !t.getStatus().isTerminal()).findFirst().orElse(null);
    }

    private boolean isDue(Task task) {
        return task.getNextCheckAt() == null || !task.getNextCheckAt().isAfter(clock.instant());
    }

    /** Any task FAILED → pipeline FAILED; all DONE → pipeline DONE — both via the RUNNING-guarded finish() CAS so
     *  a converge can never overwrite a pipeline a concurrent cancel already moved to CANCELLED. */
    private void converge(Long pipelineId) {
        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipelineId);
        if (chain.stream().anyMatch(t -> t.getStatus() == TaskStatus.FAILED)) {
            pipelines.finish(pipelineId, PipelineStatus.FAILED, clock.instant());
        } else if (chain.stream().allMatch(t -> t.getStatus() == TaskStatus.DONE)) {
            pipelines.finish(pipelineId, PipelineStatus.DONE, clock.instant());
        }
    }
}
