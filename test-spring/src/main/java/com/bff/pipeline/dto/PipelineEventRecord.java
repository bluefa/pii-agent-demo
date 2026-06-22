package com.bff.pipeline.dto;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.Severity;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * One append-only outbox row to record (Decision 1.3): the owning pipeline ({@code null} for a global
 * event), the originating task ({@code null} for pipeline-level events), the event type, severity, the
 * actor that caused it, and an optional JSON payload. {@code createdAt}/{@code notifiedAt} are owned by
 * the recorder, not the caller.
 */
@Getter
@Builder
public class PipelineEventRecord {

    @Nullable
    private final Long pipelineId;
    @Nullable
    private final Long taskId;
    private final String type;
    private final Severity severity;
    private final Actor actor;
    @Nullable
    private final String payload;
}
