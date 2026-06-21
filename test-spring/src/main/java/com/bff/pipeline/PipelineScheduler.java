package com.bff.pipeline;

import com.bff.pipeline.ops.AlertService;
import com.bff.pipeline.ops.Notifier;
import com.bff.pipeline.reconciler.Reconciler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The background cadence (orchestrator-design §1.1) — the only thing that "pushes" the durable state machine.
 * The reconciler tick is leader-gated inside {@link Reconciler#tick()} (advisory lock); the outbox
 * {@link Notifier} is multi-pod safe via FOR UPDATE SKIP LOCKED so every pod may run it; the alert scans are
 * idempotent (single-rollup dedup) so they need no leader. Intervals are configurable so tests can quiet them.
 */
@Component
public class PipelineScheduler {

    private final Reconciler reconciler;
    private final AlertService alerts;
    private final Notifier notifier;

    public PipelineScheduler(Reconciler reconciler, AlertService alerts, Notifier notifier) {
        this.reconciler = reconciler;
        this.alerts = alerts;
        this.notifier = notifier;
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
        notifier.consume();
    }
}
