package com.bff.pipeline.service;

import com.bff.pipeline.dto.PipelineEventRecord;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.repository.PipelineEventRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/**
 * Outbox write side (Decision 1.3): the single, append-only way to record a {@code pipeline_event}.
 * Callers invoke this <em>inside their own transaction</em> (creation T2, transition T4, control T5,
 * settings audit T6) so the event lands in the same commit as the state change — no loss. The consumer
 * (PipelineAlertNotifier, T6) is a separate component that claims {@code notifiedAt IS NULL} rows; this side never
 * stamps {@code notifiedAt} (it is left null = unsent).
 *
 * <p>{@code createdAt} comes from the injected {@link Clock} so event ordering is deterministic in tests.
 */
@Service
public class PipelineEventRecorder {

    private final PipelineEventRepository events;
    private final Clock clock;

    public PipelineEventRecorder(PipelineEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    /**
     * Append a pipeline-scoped event. The record's {@code pipelineId} must be non-null for pipeline events;
     * {@code taskId} is null when the event is pipeline-level.
     */
    public PipelineEvent recordPipelineEvent(PipelineEventRecord record) {
        Objects.requireNonNull(record.getPipelineId(), "pipelineId");
        return insert(record);
    }

    /**
     * Append a global (non-pipeline) event — e.g. a settings change audit. {@code pipelineId} is null,
     * which is permitted by the outbox schema.
     */
    public PipelineEvent recordGlobalEvent(PipelineEventRecord record) {
        return insert(record);
    }

    private PipelineEvent insert(PipelineEventRecord record) {
        Objects.requireNonNull(record.getType(), "type");
        Objects.requireNonNull(record.getSeverity(), "severity");
        Objects.requireNonNull(record.getActor(), "actor");
        PipelineEvent event = new PipelineEvent();
        event.setPipelineId(record.getPipelineId());
        event.setTaskId(record.getTaskId());
        event.setType(record.getType());
        event.setSeverity(record.getSeverity());
        event.setActor(record.getActor());
        event.setPayload(record.getPayload());
        event.setCreatedAt(Instant.now(clock));
        // notifiedAt stays null — the PipelineAlertNotifier (T6) stamps it on send.
        return events.save(event);
    }
}
