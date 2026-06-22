package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.PipelineEventType;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * In-app operational alerts (operations §알림) — both ends of the transactional outbox in one cohesive bean.
 * v1 emits ONLY {@code pipeline_event} (the outbox → no loss, at-least-once); external channels are v2.
 *
 * <p>The producer side scans for alert conditions ({@link #checkWorkerOutage()}, {@link #checkQueueWait()}),
 * each a single-rollup that suppresses a duplicate while a same-type alert is already live in the window.
 * The consumer side ({@link #consume()}) claims unsent rows with {@code FOR UPDATE SKIP LOCKED} (so N pods
 * divide the outbox without a leader) and stamps {@code notified_at}; delivery is at-least-once and crash-safe
 * (a row whose stamp didn't commit stays unsent and is re-claimed). Each method opens its own transaction.
 */
@Component
public class PipelineAlertService {

    /** Consecutive execution timeouts that read as a systemic worker outage rather than one bad job. */
    private static final int WORKER_OUTAGE_THRESHOLD = 3;

    private final TaskAttemptRepository attempts;
    private final TaskRepository tasks;
    private final PipelineEventRepository events;
    private final PipelineEventRecorder recorder;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public PipelineAlertService(TaskAttemptRepository attempts, TaskRepository tasks, PipelineEventRepository events,
                        PipelineEventRecorder recorder, PipelineEngineSettings settings, Clock clock) {
        this.attempts = attempts;
        this.tasks = tasks;
        this.events = events;
        this.recorder = recorder;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * WORKER_OUTAGE_SUSPECTED (critical) when execution timeouts cluster within the window — systemic worker
     * failure, not one stuck job (operations §장애 대응). Single rollup, alert only (no circuit breaker).
     */
    @Transactional
    public void checkWorkerOutage() {
        Instant windowStart = clock.instant().minus(settings.getExecutionTimeout());
        long timeouts = attempts.countByErrorCodeAndFinishedAtAfter(ErrorCode.EXECUTION_TIMEOUT, windowStart);
        if (timeouts >= WORKER_OUTAGE_THRESHOLD
                && !events.existsByTypeAndCreatedAtAfter(PipelineEventType.WORKER_OUTAGE_SUSPECTED.wire(), windowStart)) {
            recorder.recordGlobalEvent(PipelineEvent.builder()
                    .type(PipelineEventType.WORKER_OUTAGE_SUSPECTED.wire()).severity(Severity.CRITICAL).actor(Actor.SYSTEM).build());
        }
    }

    /**
     * QUEUE_WAIT_EXCEEDED when a TERRAFORM_JOB sits in the slot queue past the threshold (slotCap saturation /
     * worker stall). V1 proxy for the dwell: a still-READY TF task whose owning pipeline started before the
     * threshold (a long-running run that has not been admitted a slot). Single rollup within the window.
     */
    @Transactional
    public void checkQueueWait() {
        Instant threshold = clock.instant().minus(settings.getQueueWaitAlert());
        if (tasks.existsSlotQueuedTaskStartedBefore(threshold)
                && !events.existsByTypeAndCreatedAtAfter(PipelineEventType.QUEUE_WAIT_EXCEEDED.wire(), threshold)) {
            recorder.recordGlobalEvent(PipelineEvent.builder()
                    .type(PipelineEventType.QUEUE_WAIT_EXCEEDED.wire()).severity(Severity.CRITICAL).actor(Actor.SYSTEM).build());
        }
    }

    /**
     * The outbox consumer (Decision 1.3): claim unsent {@code pipeline_event} rows (FOR UPDATE SKIP LOCKED) and
     * stamp {@code notified_at}. Append-only writes are the producer's job (in the state-change tx); this only
     * marks delivery. At-least-once and crash-safe; in-app read-dedup by event id makes it effectively-once.
     */
    @Transactional
    public int consume() {
        List<PipelineEvent> batch = events.claimUnsent();
        Instant now = clock.instant();
        for (PipelineEvent event : batch) {
            event.setNotifiedAt(now);
            events.save(event);
        }
        return batch.size();
    }
}
