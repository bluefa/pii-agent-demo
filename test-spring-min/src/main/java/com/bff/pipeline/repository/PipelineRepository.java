package com.bff.pipeline.repository;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PipelineRepository extends JpaRepository<Pipeline, Long> {

    List<Pipeline> findByStatusOrderByIdAsc(PipelineStatus status);

    /** The current active (RUNNING) run for a target, if any — the duplicate-create returns it. Uniqueness is
     *  per TARGET (one active pipeline per target), so this does NOT filter by type. */
    Optional<Pipeline> findFirstByTargetAndStatus(String target, PipelineStatus status);

    /** Converge the pipeline to a terminal status (guarded: only from RUNNING), so a converge can never clobber a
     *  pipeline a concurrent cancel already moved to CANCELLED. Flush+clear so callers re-read the DB state, not a
     *  stale first-level-cache entity left by this bulk update. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Pipeline p set p.status = :to, p.lastActivityAt = :now "
            + "where p.id = :id and p.status = com.bff.pipeline.domain.PipelineStatus.RUNNING")
    int finish(@Param("id") Long id, @Param("to") PipelineStatus to, @Param("now") java.time.Instant now);
}
