package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.Severity;

import java.time.Instant;

/** API view of a pipeline_event (audit log / outbox row). */
public record PipelineEventView(Long id, Long pipelineId, Long taskId, String type, Severity severity,
                                String payload, Actor actor, Instant createdAt) {

    public static PipelineEventView of(PipelineEvent e) {
        return new PipelineEventView(e.getId(), e.getPipelineId(), e.getTaskId(), e.getType(), e.getSeverity(),
                e.getPayload(), e.getActor(), e.getCreatedAt());
    }
}
