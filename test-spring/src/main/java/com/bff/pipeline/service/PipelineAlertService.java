package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.dto.PipelineEventRecord;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * In-app operational alerts (operations §알림). v1 emits ONLY {@code pipeline_event} (the transactional
 * outbox → no loss, at-least-once); external channels are v2. Each check is a single-rollup: it suppresses a
 * duplicate while a same-type alert is already live in the window.
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
    private final java.time.Clock clock;

    public PipelineAlertService(TaskAttemptRepository attempts, TaskRepository tasks, PipelineEventRepository events,
                        PipelineEventRecorder recorder, PipelineEngineSettings settings, java.time.Clock clock) {
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
                && !events.existsByTypeAndCreatedAtAfter("WORKER_OUTAGE_SUSPECTED", windowStart)) {
            recorder.recordGlobalEvent(PipelineEventRecord.builder()
                    .type("WORKER_OUTAGE_SUSPECTED").severity(Severity.CRITICAL).actor(Actor.SYSTEM).build());
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
                && !events.existsByTypeAndCreatedAtAfter("QUEUE_WAIT_EXCEEDED", threshold)) {
            recorder.recordGlobalEvent(PipelineEventRecord.builder()
                    .type("QUEUE_WAIT_EXCEEDED").severity(Severity.CRITICAL).actor(Actor.SYSTEM).build());
        }
    }
}
