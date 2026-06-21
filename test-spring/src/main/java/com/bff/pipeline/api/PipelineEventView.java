package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.Severity;

import java.time.Instant;

/**
 * API view of a pipeline_event. {@code message} is the rendered display string (api §0): the stored jsonb
 * {@code payload} when present, else the event {@code type} as the V1 label (rich payload→message rendering
 * is a later, controller-layer concern). {@code type} is retained for programmatic filtering.
 */
public record PipelineEventView(Long id, Long pipelineId, Long taskId, String type, Severity severity,
                                String message, Actor actor, Instant createdAt) {

    public static PipelineEventView of(PipelineEvent e) {
        String message = e.getPayload() != null ? e.getPayload() : e.getType();
        return new PipelineEventView(e.getId(), e.getPipelineId(), e.getTaskId(), e.getType(), e.getSeverity(),
                message, e.getActor(), e.getCreatedAt());
    }
}
