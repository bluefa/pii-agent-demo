package com.bff.pipeline.reconcile;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The background cadence (minimal-redesign.md §3): fire the reconciler tick every {@code pipeline.tick-interval}
 * — the same property {@link com.bff.pipeline.config.PipelineSettings} binds, so cadence has one source of
 * truth. Single-node, so no leader election; the tick just runs. Tests drive {@link Reconciler#tick()} directly.
 */
@Component
public class ReconcileScheduler {

    private final Reconciler reconciler;

    public ReconcileScheduler(Reconciler reconciler) {
        this.reconciler = reconciler;
    }

    @Scheduled(fixedDelayString = "${pipeline.tick-interval}", initialDelayString = "PT5S")
    public void tick() {
        reconciler.tick();
    }
}
