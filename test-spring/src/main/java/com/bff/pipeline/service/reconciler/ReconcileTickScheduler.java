package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.service.PipelineAlertService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The background cadence (orchestrator-design §1.1) — the only thing that "pushes" the durable state machine.
 * The reconciler tick is leader-gated inside {@link PipelineReconciler#tick()} (advisory lock); the outbox
 * flush ({@link PipelineAlertService#consume()}) is multi-pod safe via FOR UPDATE SKIP LOCKED so every pod may
 * run it; the alert scans are idempotent (single-rollup dedup) so they need no leader. Intervals are
 * configurable so tests can quiet them.
 */
@Component
public class ReconcileTickScheduler {

    private final PipelineReconciler reconciler;
    private final PipelineAlertService alerts;

    public ReconcileTickScheduler(PipelineReconciler reconciler, PipelineAlertService alerts) {
        this.reconciler = reconciler;
        this.alerts = alerts;
    }

    @Scheduled(fixedDelayString = "${pipeline.scheduler.tick-ms:30000}",
            initialDelayString = "${pipeline.scheduler.initial-delay-ms:5000}")
    public void tick() {
        reconciler.tick();
    }

    @Scheduled(fixedDelayString = "${pipeline.scheduler.alert-ms:60000}",
            initialDelayString = "${pipeline.scheduler.initial-delay-ms:5000}")
    public void scanAlerts() {
        alerts.checkWorkerOutage();
        alerts.checkQueueWait();
    }

    @Scheduled(fixedDelayString = "${pipeline.scheduler.notify-ms:10000}",
            initialDelayString = "${pipeline.scheduler.initial-delay-ms:5000}")
    public void flushOutbox() {
        alerts.consume();
    }
}
