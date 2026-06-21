package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;

import java.time.Instant;

/** Board row / latest view of a pipeline run (api §1). */
public record PipelineSummary(Long id, String targetSourceId, PipelineType type, String provider,
                              PipelineStatus status, Actor triggeredBy, Instant startedAt, Instant finishedAt,
                              Instant lastActivityAt, FailReason failReason, Progress progress) {

    public static PipelineSummary of(Pipeline p, Progress progress) {
        return new PipelineSummary(p.getId(), p.getTargetSourceId(), p.getType(), p.getProvider(), p.getStatus(),
                p.getTriggeredBy(), p.getStartedAt(), p.getFinishedAt(), p.getLastActivityAt(), FailReason.of(p), progress);
    }
}
