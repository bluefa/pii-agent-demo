package com.bff.pipeline.dto;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.Severity;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * API view of a pipeline_event. {@code message} is the rendered display string (api §0): the stored jsonb
 * {@code payload} when present, else the event {@code type} as the V1 label (rich payload→message rendering
 * is a later, controller-layer concern). {@code type} is retained for programmatic filtering.
 */
@Getter
@Builder
public class PipelineEventView {

    private final Long id;
    @Nullable
    private final Long pipelineId;
    @Nullable
    private final Long taskId;
    private final String type;
    private final Severity severity;
    private final String message;
    private final Actor actor;
    private final Instant createdAt;

    public static PipelineEventView of(PipelineEvent e) {
        String message = e.getPayload() != null ? e.getPayload() : e.getType();
        return PipelineEventView.builder()
                .id(e.getId())
                .pipelineId(e.getPipelineId())
                .taskId(e.getTaskId())
                .type(e.getType())
                .severity(e.getSeverity())
                .message(message)
                .actor(e.getActor())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
