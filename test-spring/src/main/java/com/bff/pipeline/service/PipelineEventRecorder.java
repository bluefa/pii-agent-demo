package com.bff.pipeline.service;

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
 * <p>The caller builds the {@link PipelineEvent} (type/severity/actor/pipelineId/taskId/payload) with the
 * entity builder; this recorder owns only {@code createdAt} (from the injected {@link Clock}, so event
 * ordering is deterministic in tests) and leaves {@code notifiedAt} null.
 */
@Service
public class PipelineEventRecorder {

    private final PipelineEventRepository events;
    private final Clock clock;

    public PipelineEventRecorder(PipelineEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    /** Append a pipeline-scoped event — {@code pipelineId} must be non-null; {@code taskId} may be null. */
    public PipelineEvent recordPipelineEvent(PipelineEvent event) {
        Objects.requireNonNull(event.getPipelineId(), "pipelineId");
        return insert(event);
    }

    /** Append a global (non-pipeline) event — e.g. a settings change audit; {@code pipelineId} is null. */
    public PipelineEvent recordGlobalEvent(PipelineEvent event) {
        return insert(event);
    }

    private PipelineEvent insert(PipelineEvent event) {
        Objects.requireNonNull(event.getType(), "type");
        Objects.requireNonNull(event.getSeverity(), "severity");
        Objects.requireNonNull(event.getActor(), "actor");
        event.setCreatedAt(Instant.now(clock));
        // notifiedAt stays null — the PipelineAlertNotifier (T6) stamps it on send.
        return events.save(event);
    }
}
