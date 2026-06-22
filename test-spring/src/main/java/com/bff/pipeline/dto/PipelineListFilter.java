package com.bff.pipeline.dto;

import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/** Optional board filters (api §1). A null field is "no filter"; {@code [from,to)} is a time-window overlap. */
@Getter
@Builder
public class PipelineListFilter {

    @Nullable
    private final PipelineStatus status;
    @Nullable
    private final PipelineType type;
    @Nullable
    private final String provider;
    @Nullable
    private final String targetSourceId;
    @Nullable
    private final Instant from;
    @Nullable
    private final Instant to;
}
