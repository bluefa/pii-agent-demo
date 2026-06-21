package com.bff.pipeline.reconciler;

import com.bff.pipeline.ops.RuntimeSettings;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The reconciler tick (orchestrator-design §1.1). On the leader only, it advances every non-terminal task of
 * every active (RUNNING / CANCELLING) pipeline one step, then derives each pipeline's status, then prunes the
 * observation ledger. A per-tick poll/check budget ({@link TickBudget}) caps external-call fan-out.
 *
 * <p>Tasks are serviced in the global due order (SCOPE §3 / D-T7): {@code next_check_at ASC},
 * {@code last_checked_at ASC NULLS FIRST} (starvation avoidance), then id — so under budget pressure the
 * longest-overdue task is polled first, never starved behind a newer pipeline.
 *
 * <p>Deliberately NOT transactional: each {@link TaskAdvancer#advance} and {@link PipelineDeriver#derive} is
 * its own committed transaction, so a later read in the same tick sees the prior commits — the slotCap COUNT
 * sees just-admitted slots, the predecessor read sees a same-tick DONE, and derive sees terminal states.
 */
@Component
public class Reconciler {

    private static final List<PipelineStatus> ACTIVE = List.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);

    private static final Comparator<Servicing> DUE_ORDER = Comparator
            .comparing((Servicing s) -> s.task().getNextCheckAt(), Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(s -> s.task().getLastCheckedAt(), Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(s -> s.task().getId());

    private final Leader leader;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final TaskAdvancer advancer;
    private final PipelineDeriver deriver;
    private final TaskCheckPruner pruner;
    private final RuntimeSettings settings;
    private final Clock clock;

    public Reconciler(Leader leader, PipelineRepository pipelines, TaskRepository tasks, TaskAdvancer advancer,
                      PipelineDeriver deriver, TaskCheckPruner pruner, RuntimeSettings settings, Clock clock) {
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

        List<Pipeline> active = pipelines.findByStatusInOrderByIdAsc(ACTIVE);
        List<Servicing> queue = new ArrayList<>();
        for (Pipeline pipeline : active) {
            for (Task task : tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId())) {
                if (!task.getStatus().isTerminal()) {
                    queue.add(new Servicing(pipeline, task));
                }
            }
        }
        queue.sort(DUE_ORDER);
        for (Servicing s : queue) {
            boolean due = s.task().getNextCheckAt() == null || !s.task().getNextCheckAt().isAfter(now);
            advancer.advance(s.pipeline(), s.task(), due, budget);
        }
        for (Pipeline pipeline : active) {
            deriver.derive(pipeline, tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()));
        }
        pruner.prune();
    }

    private record Servicing(Pipeline pipeline, Task task) {
    }
}
