package com.bff.pipeline.service;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineType;

/** A request to create (or idempotently resolve) a pipeline run for one target. */
public record CreationRequest(PipelineType type, String provider, String targetSourceId, Actor triggeredBy) {
}
