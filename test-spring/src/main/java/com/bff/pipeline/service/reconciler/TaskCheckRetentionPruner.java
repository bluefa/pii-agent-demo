package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.repository.TaskCheckRepository;
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
public class TaskCheckRetentionPruner {

    private final TaskCheckRepository checks;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public TaskCheckRetentionPruner(TaskCheckRepository checks, PipelineEngineSettings settings, Clock clock) {
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
