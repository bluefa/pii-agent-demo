package com.bff.pipeline.service;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.repo.PipelineEventRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/**
 * Outbox write side (Decision 1.3): the single, append-only way to record a {@code pipeline_event}.
 * Callers invoke this <em>inside their own transaction</em> (creation T2, transition T4, control T5,
 * settings audit T6) so the event lands in the same commit as the state change — no loss. The consumer
 * (Notifier, T6) is a separate component that claims {@code notifiedAt IS NULL} rows; this side never
 * stamps {@code notifiedAt} (it is left null = unsent).
 *
 * <p>{@code createdAt} comes from the injected {@link Clock} so event ordering is deterministic in tests.
 */
@Service
public class EventRecorder {

    private final PipelineEventRepository events;
    private final Clock clock;

    public EventRecorder(PipelineEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    /**
     * Append a pipeline-scoped event.
     *
     * @param pipelineId owning pipeline (non-null for pipeline events)
     * @param taskId     originating task, or null when the event is pipeline-level
     */
    public PipelineEvent recordPipelineEvent(
            Long pipelineId, Long taskId, String type, Severity severity, Actor actor, String payload) {
        Objects.requireNonNull(pipelineId, "pipelineId");
        return insert(pipelineId, taskId, type, severity, actor, payload);
    }

    /**
     * Append a global (non-pipeline) event — e.g. a settings change audit. {@code pipelineId} is null,
     * which is permitted by the outbox schema.
     */
    public PipelineEvent recordGlobalEvent(String type, Severity severity, Actor actor, String payload) {
        return insert(null, null, type, severity, actor, payload);
    }

    private PipelineEvent insert(
            Long pipelineId, Long taskId, String type, Severity severity, Actor actor, String payload) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(severity, "severity");
        Objects.requireNonNull(actor, "actor");
        PipelineEvent event = new PipelineEvent();
        event.setPipelineId(pipelineId);
        event.setTaskId(taskId);
        event.setType(type);
        event.setSeverity(severity);
        event.setActor(actor);
        event.setPayload(payload);
        event.setCreatedAt(Instant.now(clock));
        // notifiedAt stays null — the Notifier (T6) stamps it on send.
        return events.save(event);
    }
}
