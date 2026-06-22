package com.bff.pipeline.service;
import com.bff.pipeline.dto.PipelineCreationRequest;
import com.bff.pipeline.dto.PipelineCreationResult;

import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.repository.PipelineRepository;
import lombok.NonNull;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

/**
 * Pipeline creation (Decision 7). Resolves the (type, provider) recipe and atomically writes the run via
 * {@link PipelineRunWriter}. The "one non-terminal run per target" rule is enforced by the DB (the
 * non-terminal-unique column on {@code pipeline}); a concurrent/duplicate create therefore fails with a
 * constraint violation, which we translate into "return the existing run" ({@code created == false})
 * rather than surfacing an error — the idempotent creation contract (§7.2).
 */
@Service
public class PipelineCreationService {

    private static final Set<PipelineStatus> NON_TERMINAL =
            EnumSet.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);

    private final PipelineRunWriter writer;
    private final PipelineRepository pipelines;

    public PipelineCreationService(PipelineRunWriter writer, PipelineRepository pipelines) {
        this.writer = writer;
        this.pipelines = pipelines;
    }

    public PipelineCreationResult create(@NonNull PipelineCreationRequest request) {
        try {
            return PipelineCreationResult.builder().pipeline(writer.insertNewRun(request)).created(true).build();
        } catch (DataIntegrityViolationException violation) {
            // Only the active-target unique violation (one non-terminal run per target) is idempotency.
            // Any other integrity failure (FK, not-null, ...) is a real error and must propagate.
            if (isUniqueViolation(violation)) {
                Optional<Pipeline> existing = pipelines
                        .findFirstByTargetSourceIdAndStatusInOrderByStartedAtDesc(request.getTargetSourceId(), NON_TERMINAL);
                if (existing.isPresent()) {
                    return PipelineCreationResult.builder().pipeline(existing.get()).created(false).build();
                }
            }
            throw violation;
        }
    }

    /**
     * SQLSTATE 23505 = unique violation on both H2 and Postgres. The only unique constraint a fresh
     * insert can hit is {@code uq_pipeline_active_target}, so a 23505 here means a non-terminal run for
     * the target already exists; non-unique integrity failures carry other SQLSTATEs and are not idempotency.
     */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        return e.getMostSpecificCause() instanceof SQLException sql && "23505".equals(sql.getSQLState());
    }
}
