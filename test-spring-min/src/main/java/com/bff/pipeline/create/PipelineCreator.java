package com.bff.pipeline.create;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.repository.PipelineRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * Creates one pipeline run for a target (minimal-redesign.md §5). Per-TARGET uniqueness is the DB partial-unique
 * (one active pipeline per target — a concurrent INSTALL and DELETE for the same target is nonsensical): a
 * duplicate create collides against the still-active run, of any type, and returns it instead of starting a
 * second. NOT {@code @Transactional} — the insert is the {@link PipelineInserter}'s own committed transaction, so
 * its unique-violation rollback stays isolated and the recovery (find the existing run) runs cleanly here.
 */
@Service
public class PipelineCreator {

    private final PipelineInserter inserter;
    private final PipelineRepository pipelines;

    public PipelineCreator(PipelineInserter inserter, PipelineRepository pipelines) {
        this.inserter = inserter;
        this.pipelines = pipelines;
    }

    /** Start a run for the target, or return the existing active run (of any type) if one is already in flight. */
    public Pipeline create(String target, PipelineType type) {
        try {
            return inserter.insert(target, type);
        } catch (DataIntegrityViolationException duplicate) {
            return pipelines.findFirstByTargetAndStatus(target, PipelineStatus.RUNNING)
                    .orElseThrow(() -> duplicate); // a non-uniqueness integrity error is a real failure
        }
    }
}
