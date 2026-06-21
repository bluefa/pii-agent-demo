package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.service.CreationRequest;
import com.bff.pipeline.service.CreationResult;
import com.bff.pipeline.service.EventRecorder;
import com.bff.pipeline.service.PipelineCreationService;
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
    private final EventRecorder events;
    private final Clock clock;

    public PipelineControlService(PipelineRepository pipelines, PipelineCreationService creation,
                                  EventRecorder events, Clock clock) {
        this.pipelines = pipelines;
        this.creation = creation;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public CancelResult cancel(Long pipelineId, Actor actor) {
        if (pipelines.casStatus(pipelineId, PipelineStatus.RUNNING, PipelineStatus.CANCELLING, clock.instant()) > 0) {
            events.recordPipelineEvent(pipelineId, null, "PIPELINE:CANCELLING", Severity.INFO, actor, null);
        }
        // idempotent: a terminal / already-CANCELLING run matched 0 rows — report its current status, not an error.
        PipelineStatus status = pipelines.findById(pipelineId)
                .map(Pipeline::getStatus)
                .orElseThrow(() -> new IllegalArgumentException("no pipeline " + pipelineId));
        return new CancelResult(pipelineId, status);
    }

    public RetryResult retry(PipelineType type, String provider, String targetSourceId, Actor actor) {
        CreationResult result = creation.create(new CreationRequest(type, provider, targetSourceId, actor));
        if (!result.created()) {
            // an existing non-terminal run blocked the new one; record who tried (the creation event is absent).
            events.recordPipelineEvent(result.pipeline().getId(), null, "PIPELINE:RETRY_ATTEMPTED", Severity.INFO, actor, null);
        }
        return new RetryResult(result.pipeline().getId(), result.created());
    }

    public record CancelResult(Long id, PipelineStatus status) {
    }

    public record RetryResult(Long pipelineId, boolean created) {
    }
}
