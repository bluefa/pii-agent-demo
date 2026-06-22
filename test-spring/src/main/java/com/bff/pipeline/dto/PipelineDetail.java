package com.bff.pipeline.dto;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.List;

/**
 * Pipeline drill-down (api §1 detail) — the full run flattened plus its task chain. Distinct from the leaner
 * board/latest {@link PipelineSummary}: detail also carries {@code createdAt}.
 */
@Getter
@Builder
public class PipelineDetail {

    private final Long id;
    private final String targetSourceId;
    private final PipelineType type;
    private final String provider;
    private final PipelineStatus status;
    private final Actor triggeredBy;
    @Nullable
    private final Instant createdAt;
    @Nullable
    private final Instant startedAt;
    @Nullable
    private final Instant finishedAt;
    @Nullable
    private final Instant lastActivityAt;
    @Nullable
    private final FailReason failReason;
    private final Progress progress;
    private final List<TaskView> tasks;

    public static PipelineDetail of(Pipeline p, Progress progress, List<TaskView> tasks) {
        return PipelineDetail.builder()
                .id(p.getId())
                .targetSourceId(p.getTargetSourceId())
                .type(p.getType())
                .provider(p.getProvider())
                .status(p.getStatus())
                .triggeredBy(p.getTriggeredBy())
                .createdAt(p.getCreatedAt())
                .startedAt(p.getStartedAt())
                .finishedAt(p.getFinishedAt())
                .lastActivityAt(p.getLastActivityAt())
                .failReason(FailReason.of(p))
                .progress(progress)
                .tasks(tasks)
                .build();
    }
}
