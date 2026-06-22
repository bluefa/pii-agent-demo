package com.bff.pipeline.dto;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.PipelineType;
import lombok.Builder;
import lombok.Getter;

/** A request to create (or idempotently resolve) a pipeline run for one target. */
@Getter
@Builder
public class PipelineCreationRequest {

    private final PipelineType type;
    private final String provider;
    private final String targetSourceId;
    private final Actor triggeredBy;
}
