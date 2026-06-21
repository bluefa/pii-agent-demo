package com.bff.pipeline.service;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.repo.PipelineRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Set;

/**
 * Pipeline creation (Decision 7). Resolves the (type, provider) recipe and atomically writes the run via
 * {@link NewRunWriter}. The "one non-terminal run per target" rule is enforced by the DB (the
 * non-terminal-unique column on {@code pipeline}); a concurrent/duplicate create therefore fails with a
 * constraint violation, which we translate into "return the existing run" ({@code created == false})
 * rather than surfacing an error — the idempotent creation contract (§7.2).
 */
@Service
public class PipelineCreationService {

    private static final Set<PipelineStatus> NON_TERMINAL =
            EnumSet.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);

    private final NewRunWriter writer;
    private final PipelineRepository pipelines;

    public PipelineCreationService(NewRunWriter writer, PipelineRepository pipelines) {
        this.writer = writer;
        this.pipelines = pipelines;
    }

    public CreationResult create(CreationRequest request) {
        try {
            return new CreationResult(writer.insertNewRun(request), true);
        } catch (DataIntegrityViolationException duplicate) {
            Pipeline existing = pipelines
                    .findFirstByTargetSourceIdAndStatusInOrderByStartedAtDesc(request.targetSourceId(), NON_TERMINAL)
                    .orElseThrow(() -> duplicate); // a violation with no surviving non-terminal run is unexpected
            return new CreationResult(existing, false);
        }
    }
}
