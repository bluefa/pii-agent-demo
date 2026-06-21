package com.bff.pipeline.repo;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
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

    // ---- guarded CAS (explicit prior-state predicate; NOT @Version-as-CAS) ----
    // A 0-row result is the no-op: the prior status did not match (terminal revival / stale write
    // blocked). Callers MUST treat 0 rows as "transition not applied" — never assume success.

    /**
     * Status CAS: {@code status=:expected -> :to}, bump {@code lastActivityAt} and {@code version}.
     * Cancel uses this with {@code expected=RUNNING} (terminal/CANCELLING => 0 rows, idempotent).
     */
    @Modifying
    @Query("update Pipeline p set p.status = :to, p.lastActivityAt = :now, p.version = p.version + 1 "
            + "where p.id = :id and p.status = :expected")
    int casStatus(@Param("id") Long id,
                  @Param("expected") PipelineStatus expected,
                  @Param("to") PipelineStatus to,
                  @Param("now") Instant now);

    /**
     * FAILED-convergence CAS: same status CAS, additionally recording {@code fail_reason}
     * ({@code task_id}, {@code error_code}) and {@code finishedAt}. The error_code source is case-specific
     * (attempt / task_check / synthetic) — the caller supplies the already-resolved code.
     */
    @Modifying
    @Query("update Pipeline p set p.status = :to, p.failReasonTaskId = :failTaskId, "
            + "p.failReasonErrorCode = :failCode, p.finishedAt = :now, p.lastActivityAt = :now, "
            + "p.version = p.version + 1 where p.id = :id and p.status = :expected")
    int casStatusWithFailReason(@Param("id") Long id,
                                @Param("expected") PipelineStatus expected,
                                @Param("to") PipelineStatus to,
                                @Param("failTaskId") Long failTaskId,
                                @Param("failCode") ErrorCode failCode,
                                @Param("now") Instant now);

    /**
     * Terminal CAS to a non-FAILED terminal (DONE / CANCELLED): set status + {@code finishedAt} and bump
     * {@code lastActivityAt}/{@code version}. fail_reason stays null (CANCELLED/DONE invariant).
     */
    @Modifying
    @Query("update Pipeline p set p.status = :to, p.finishedAt = :now, p.lastActivityAt = :now, "
            + "p.version = p.version + 1 where p.id = :id and p.status = :expected")
    int casTerminal(@Param("id") Long id,
                    @Param("expected") PipelineStatus expected,
                    @Param("to") PipelineStatus to,
                    @Param("now") Instant now);

    /**
     * Bump {@code lastActivityAt} without changing status — a task-level transition must refresh the
     * owning pipeline's board-sort key in the same tick tx. Unconditional (no prior-state guard).
     */
    @Modifying
    @Query("update Pipeline p set p.lastActivityAt = :now where p.id = :id")
    int touchActivity(@Param("id") Long id, @Param("now") Instant now);
}
