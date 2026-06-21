package com.bff.pipeline.repo;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PipelineRepository extends JpaRepository<Pipeline, Long> {

    /** active pipelines for the tick (RUNNING, CANCELLING), oldest first. */
    List<Pipeline> findByStatusInOrderByIdAsc(Collection<PipelineStatus> statuses);

    /**
     * the non-terminal pipeline for a target, if any (creation/retry contract). The partial unique
     * constraint {@code unique(target_source_id) WHERE non-terminal} guarantees at most one.
     */
    Optional<Pipeline> findFirstByTargetSourceIdAndStatusInOrderByStartedAtDesc(
            String targetSourceId, Collection<PipelineStatus> statuses);

    /** most recent terminal run for a target (history "latest" fallback). */
    Optional<Pipeline> findFirstByTargetSourceIdOrderByStartedAtDesc(String targetSourceId);
}
