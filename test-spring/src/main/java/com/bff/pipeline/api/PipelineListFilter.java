package com.bff.pipeline.api;

import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;

import java.time.Instant;

/** Optional board filters (api §1). A null field is "no filter"; {@code [from,to)} is a time-window overlap. */
public record PipelineListFilter(PipelineStatus status, PipelineType type, String provider, String targetSourceId,
                                 Instant from, Instant to) {
}
