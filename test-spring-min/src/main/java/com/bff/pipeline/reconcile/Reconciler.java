package com.bff.pipeline.reconcile;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.repository.PipelineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The reconciler tick (minimal-redesign.md §3): the one thing that pushes the durable state machine. Each tick
 * scans the RUNNING pipelines and reconciles each one through {@link PipelineReconciliation} (its own committed
 * transaction). Single-node, always the leader — correctness is the DB row, not the scheduling.
 *
 * <p>Each pipeline is reconciled in its own try/catch so one pipeline's failure (a transient IM error, an
 * optimistic-lock clash with a concurrent cancel) is logged and skipped — it never aborts the tick and starves
 * the other pipelines.
 */
@Component
public class Reconciler {

    private static final Logger log = LoggerFactory.getLogger(Reconciler.class);

    private final PipelineRepository pipelines;
    private final PipelineReconciliation reconciliation;

    public Reconciler(PipelineRepository pipelines, PipelineReconciliation reconciliation) {
        this.pipelines = pipelines;
        this.reconciliation = reconciliation;
    }

    public void tick() {
        for (Pipeline scanned : pipelines.findByStatusOrderByIdAsc(PipelineStatus.RUNNING)) {
            try {
                reconciliation.reconcile(scanned.getId());
            } catch (RuntimeException e) {
                log.warn("reconcile failed for pipeline {} — skipping this tick", scanned.getId(), e);
            }
        }
    }
}
