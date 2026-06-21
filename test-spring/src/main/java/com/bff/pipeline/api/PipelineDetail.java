package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;

import java.time.Instant;
import java.util.List;

/**
 * Pipeline drill-down (api §1 detail) — the full run flattened plus its task chain. Distinct from the leaner
 * board/latest {@link PipelineSummary}: detail also carries {@code createdAt}.
 */
public record PipelineDetail(Long id, String targetSourceId, PipelineType type, String provider,
                             PipelineStatus status, Actor triggeredBy, Instant createdAt, Instant startedAt,
                             Instant finishedAt, Instant lastActivityAt, FailReason failReason, Progress progress,
                             List<TaskView> tasks) {

    public static PipelineDetail of(Pipeline p, Progress progress, List<TaskView> tasks) {
        return new PipelineDetail(p.getId(), p.getTargetSourceId(), p.getType(), p.getProvider(), p.getStatus(),
                p.getTriggeredBy(), p.getCreatedAt(), p.getStartedAt(), p.getFinishedAt(), p.getLastActivityAt(),
                FailReason.of(p), progress, tasks);
    }
}
