package com.bff.pipeline.dto;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/** Board row / latest view of a pipeline run (api §1). */
@Getter
@Builder
public class PipelineSummary {

    private final Long id;
    private final String targetSourceId;
    private final PipelineType type;
    private final String provider;
    private final PipelineStatus status;
    private final Actor triggeredBy;
    @Nullable
    private final Instant startedAt;
    @Nullable
    private final Instant finishedAt;
    @Nullable
    private final Instant lastActivityAt;
    @Nullable
    private final FailReason failReason;
    private final Progress progress;

    public static PipelineSummary of(Pipeline p, Progress progress) {
        return PipelineSummary.builder()
                .id(p.getId())
                .targetSourceId(p.getTargetSourceId())
                .type(p.getType())
                .provider(p.getProvider())
                .status(p.getStatus())
                .triggeredBy(p.getTriggeredBy())
                .startedAt(p.getStartedAt())
                .finishedAt(p.getFinishedAt())
                .lastActivityAt(p.getLastActivityAt())
                .failReason(FailReason.of(p))
                .progress(progress)
                .build();
    }
}
