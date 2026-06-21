package com.bff.pipeline.reconciler;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.repo.TaskCheckRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Retention prune (Decision 1.3 / operations): drop {@code task_check} rows whose last observation is older
 * than {@code taskCheckRetentionDays}. The observation ledger is bounded; live runs (recent {@code checkedAt})
 * and unfilled DISPATCH PENDING rows ({@code checkedAt} null) are never pruned.
 */
@Component
public class TaskCheckPruner {

    private final TaskCheckRepository checks;
    private final PipelineSettings settings;
    private final Clock clock;

    public TaskCheckPruner(TaskCheckRepository checks, PipelineSettings settings, Clock clock) {
        this.checks = checks;
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional
    public int prune() {
        Instant cutoff = clock.instant().minus(Duration.ofDays(settings.getTaskCheckRetentionDays()));
        return checks.deleteByCheckedAtBefore(cutoff);
    }
}
