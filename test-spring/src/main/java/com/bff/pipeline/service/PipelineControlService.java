package com.bff.pipeline.service;
import com.bff.pipeline.dto.PipelineCreationRequest;
import com.bff.pipeline.dto.PipelineCreationResult;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.PipelineEventType;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import com.bff.pipeline.service.PipelineCreationService;
import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/**
 * Admin control (api §2). Cancel is the single user-driven pipeline transition (RUNNING→CANCELLING, guarded
 * CAS + event, idempotent on a terminal/cancelling run). Retry is "create a new run, or return the existing
 * non-terminal one" — the latter is audited with a RETRY_ATTEMPTED event since it has no creation transition.
 */
@Service
public class PipelineControlService {

    private final PipelineRepository pipelines;
    private final PipelineCreationService creation;
    private final PipelineEventRecorder events;
    private final Clock clock;

    public PipelineControlService(PipelineRepository pipelines, PipelineCreationService creation,
                                  PipelineEventRecorder events, Clock clock) {
        this.pipelines = pipelines;
        this.creation = creation;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public CancelResult cancel(@NonNull Long pipelineId, @NonNull Actor actor) {
        if (pipelines.casStatus(pipelineId, PipelineStatus.RUNNING, PipelineStatus.CANCELLING, clock.instant()) > 0) {
            events.recordPipelineEvent(PipelineEvent.builder()
                    .pipelineId(pipelineId).type(PipelineEventType.PIPELINE_CANCELLING.wire())
                    .severity(Severity.INFO).actor(actor).build());
        }
        // idempotent: a terminal / already-CANCELLING run matched 0 rows — report its current status, not an error.
        PipelineStatus status = pipelines.findById(pipelineId)
                .map(Pipeline::getStatus)
                .orElseThrow(() -> new IllegalArgumentException("no pipeline " + pipelineId));
        return CancelResult.builder().id(pipelineId).status(status).build();
    }

    public RetryResult retry(@NonNull PipelineCreationRequest request) {
        PipelineCreationResult result = creation.create(request);
        if (!result.isCreated()) {
            // an existing non-terminal run blocked the new one; record who tried (the creation event is absent).
            events.recordPipelineEvent(PipelineEvent.builder()
                    .pipelineId(result.getPipeline().getId()).type(PipelineEventType.PIPELINE_RETRY_ATTEMPTED.wire())
                    .severity(Severity.INFO).actor(request.getTriggeredBy()).build());
        }
        return RetryResult.builder().pipelineId(result.getPipeline().getId()).created(result.isCreated()).build();
    }

    @Getter
    @Builder
    public static class CancelResult {
        private final Long id;
        private final PipelineStatus status;
    }

    @Getter
    @Builder
    public static class RetryResult {
        private final Long pipelineId;
        private final boolean created;
    }
}
