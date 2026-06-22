package com.bff.pipeline.repository;

import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.Severity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface PipelineEventRepository extends JpaRepository<PipelineEvent, Long> {

    List<PipelineEvent> findByPipelineIdOrderByCreatedAtAsc(Long pipelineId);

    /** the PipelineAlertNotifier's outbox cursor — unsent events (notifiedAt IS NULL). */
    List<PipelineEvent> findByNotifiedAtIsNullOrderByCreatedAtAsc();

    /**
     * Multi-pod outbox claim (PipelineAlertNotifier, T6): the unsent rows ({@code notifiedAt IS NULL}), oldest first,
     * locked {@code FOR UPDATE SKIP LOCKED} so concurrent consumers each grab a disjoint batch (a row another
     * pod is sending is skipped, not blocked on). Native because {@code SKIP LOCKED} is not JPQL; H2 2.2 and
     * Postgres both parse it.
     */
    @Query(value = "SELECT * FROM pipeline_event WHERE notified_at IS NULL "
            + "ORDER BY created_at FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<PipelineEvent> claimUnsent();

    /**
     * Single-rollup dedup for {@link com.bff.pipeline.service.PipelineAlertService}: has an event of {@code type} been
     * emitted within the current window ({@code createdAt > since})? True suppresses a duplicate alert.
     */
    boolean existsByTypeAndCreatedAtAfter(String type, Instant since);

    // ---- Admin audit-log queries (api §1) ----
    Page<PipelineEvent> findByPipelineId(Long pipelineId, Pageable pageable);

    Page<PipelineEvent> findByPipelineIdAndSeverity(Long pipelineId, Severity severity, Pageable pageable);
}
