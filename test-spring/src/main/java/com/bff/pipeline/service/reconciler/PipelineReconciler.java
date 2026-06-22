package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import lombok.Builder;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * The reconciler tick (orchestrator-design §1.1). On the leader only, it advances every non-terminal task of
 * every active (RUNNING / CANCELLING) pipeline one step, then derives each pipeline's status, then prunes the
 * observation ledger. A per-tick poll/check budget ({@link ExternalCallTickBudget}) caps external-call fan-out.
 *
 * <p>Tasks are serviced in the global due order (SCOPE §3 / D-T7): {@code next_check_at ASC},
 * {@code last_checked_at ASC NULLS FIRST} (starvation avoidance), then id — so under budget pressure the
 * longest-overdue task is polled first, never starved behind a newer pipeline.
 *
 * <p>Deliberately NOT transactional: each {@link PipelineTaskAdvancer#advance} and {@link PipelineStatusDeriver#derive} is
 * its own committed transaction, so a later read in the same tick sees the prior commits — the slotCap COUNT
 * sees just-admitted slots, the predecessor read sees a same-tick DONE, and derive sees terminal states.
 */
@Component
public class PipelineReconciler {

    private static final List<PipelineStatus> ACTIVE = List.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);

    private static final Comparator<Servicing> DUE_ORDER = Comparator
            .comparing((Servicing s) -> s.getTask().getNextCheckAt(), Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(s -> s.getTask().getLastCheckedAt(), Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(s -> s.getTask().getId());

    private final ReconcileLeader leader;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final PipelineTaskAdvancer advancer;
    private final PipelineStatusDeriver deriver;
    private final TaskCheckRetentionPruner pruner;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public PipelineReconciler(ReconcileLeader leader, PipelineRepository pipelines, TaskRepository tasks, PipelineTaskAdvancer advancer,
                      PipelineStatusDeriver deriver, TaskCheckRetentionPruner pruner, PipelineEngineSettings settings, Clock clock) {
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
        ExternalCallTickBudget budget = new ExternalCallTickBudget(settings.getMaxExternalCallsPerTick());

        List<Pipeline> active = pipelines.findByStatusInOrderByIdAsc(ACTIVE);
        List<Servicing> queue = active.stream()
                .flatMap(pipeline -> tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()).stream()
                        .filter(task -> !task.getStatus().isTerminal())
                        .map(task -> Servicing.builder().pipeline(pipeline).task(task).build()))
                .sorted(DUE_ORDER)
                .toList();
        for (Servicing s : queue) {
            boolean due = s.getTask().getNextCheckAt() == null || !s.getTask().getNextCheckAt().isAfter(now);
            advancer.advance(TaskTick.builder()
                    .pipeline(s.getPipeline()).task(s.getTask()).due(due).budget(budget).build());
        }
        for (Pipeline pipeline : active) {
            deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));
        }
        pruner.prune();
    }

    @Getter
    @Builder
    private static class Servicing {
        private final Pipeline pipeline;
        private final Task task;
    }
}
