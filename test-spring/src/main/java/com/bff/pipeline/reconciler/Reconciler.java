package com.bff.pipeline.reconciler;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * The reconciler tick (orchestrator-design §1.1). On the leader only, it advances every task of every active
 * (RUNNING / CANCELLING) pipeline one step, then derives each pipeline's status, then prunes the observation
 * ledger. Within one tick a poll/check budget ({@link TickBudget}) caps external-call fan-out.
 *
 * <p>Deliberately NOT transactional: each {@link TaskAdvancer#advance} and {@link PipelineDeriver#derive} is
 * its own committed transaction, so a later read in the same tick sees the prior commits — the slotCap COUNT
 * sees just-admitted slots, and {@code derive} sees the tasks' just-written terminal states.
 *
 * <p>ponytail: tasks are processed in seq order (not the full global due-sort), which is exact for the
 * sequential chains here (at most one task per pipeline is serviceable at a time); the budget still bounds
 * total fan-out. A global next_check_at starvation-sort would matter only across many concurrent pipelines.
 */
@Component
public class Reconciler {

    private static final List<PipelineStatus> ACTIVE = List.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);

    private final Leader leader;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final TaskAdvancer advancer;
    private final PipelineDeriver deriver;
    private final TaskCheckPruner pruner;
    private final PipelineSettings settings;
    private final java.time.Clock clock;

    public Reconciler(Leader leader, PipelineRepository pipelines, TaskRepository tasks, TaskAdvancer advancer,
                      PipelineDeriver deriver, TaskCheckPruner pruner, PipelineSettings settings, java.time.Clock clock) {
        this.leader = leader;
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.advancer = advancer;
        this.deriver = deriver;
        this.pruner = pruner;
        this.settings = settings;
        this.clock = clock;
    }

    public void tick() {
        if (!leader.isLeader()) {
            return;
        }
        Instant now = clock.instant();
        TickBudget budget = new TickBudget(settings.getMaxExternalCallsPerTick());
        for (Pipeline pipeline : pipelines.findByStatusInOrderByIdAsc(ACTIVE)) {
            for (Task task : tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId())) {
                boolean due = task.getNextCheckAt() == null || !task.getNextCheckAt().isAfter(now);
                advancer.advance(pipeline, task, due, budget);
            }
            deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));
        }
        pruner.prune();
    }
}
