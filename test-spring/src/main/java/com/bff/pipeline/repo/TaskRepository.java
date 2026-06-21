package com.bff.pipeline.repo;

import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByPipelineIdOrderBySeqAsc(Long pipelineId);

    /**
     * Slot admission count (Decision 4b): {@code COUNT(task WHERE kind=TERRAFORM_JOB AND status IN
     * (DISPATCHING, RUNNING))}. Global across all pipelines — slotCap is a global submission throttle.
     */
    long countByKindAndStatusIn(TaskKind kind, Collection<TaskStatus> statuses);

    // ---- guarded CAS (explicit prior-state predicate; NOT @Version-as-CAS) ----
    // Each transition is its own intention-named method; the caller passes the timestamps the
    // transition implies (startedAt on first execution, finishedAt on terminal). 0 rows = no-op:
    // the task already moved on (concurrent tick / stale read) — the caller must handle it.

    /**
     * Status-only CAS: {@code status=:expected -> :to}, bump {@code version}. For transitions that do not
     * imply a timestamp (e.g. BLOCKED -> READY, DISPATCHING -> RUNNING).
     */
    @Modifying
    @Query("update Task t set t.status = :to, t.version = t.version + 1 "
            + "where t.id = :id and t.status = :expected")
    int casStatus(@Param("id") Long id,
                  @Param("expected") TaskStatus expected,
                  @Param("to") TaskStatus to);

    /**
     * First-execution CAS: {@code status=:expected -> :to} and stamp {@code startedAt}. Used on the first
     * leave of READY (READY -> DISPATCHING for TERRAFORM_JOB, READY -> WAITING_EXTERNAL for
     * CONDITION_CHECK). Not used on BLOCKED -> READY (no execution started yet).
     */
    @Modifying
    @Query("update Task t set t.status = :to, t.startedAt = :startedAt, t.version = t.version + 1 "
            + "where t.id = :id and t.status = :expected")
    int casStatusStarting(@Param("id") Long id,
                          @Param("expected") TaskStatus expected,
                          @Param("to") TaskStatus to,
                          @Param("startedAt") Instant startedAt);

    /**
     * Terminal CAS: {@code status=:expected -> :to} (a terminal status) and stamp {@code finishedAt}.
     * Used for DONE / FAILED / EXPIRED / CANCELLED transitions.
     */
    @Modifying
    @Query("update Task t set t.status = :to, t.finishedAt = :finishedAt, t.version = t.version + 1 "
            + "where t.id = :id and t.status = :expected")
    int casStatusTerminal(@Param("id") Long id,
                          @Param("expected") TaskStatus expected,
                          @Param("to") TaskStatus to,
                          @Param("finishedAt") Instant finishedAt);

    /**
     * Increment {@code failCount} by one (the tick's fail-accounting; NOT guarded by status — the caller
     * has already established the failing transition under its own status CAS).
     */
    @Modifying
    @Query("update Task t set t.failCount = t.failCount + 1 where t.id = :id")
    int incrementFailCount(@Param("id") Long id);

    /**
     * Set both the starvation-sort key {@code lastCheckedAt} and the next due time {@code nextCheckAt} —
     * the reconciler fire: when the tick services a task it records "serviced now, due next at".
     */
    @Modifying
    @Query("update Task t set t.lastCheckedAt = :checkedAt, t.nextCheckAt = :nextCheckAt where t.id = :id")
    int setSchedule(@Param("id") Long id,
                    @Param("checkedAt") Instant checkedAt,
                    @Param("nextCheckAt") Instant nextCheckAt);

    /**
     * Set only {@code nextCheckAt} — the call-thread's backpressure path (Retry-After / cadence) defers
     * the next due time without touching {@code lastCheckedAt} (that is the tick's key).
     */
    @Modifying
    @Query("update Task t set t.nextCheckAt = :nextCheckAt where t.id = :id")
    int setNextCheckAt(@Param("id") Long id, @Param("nextCheckAt") Instant nextCheckAt);

    /**
     * Set {@code deadlineAt} — the derived absolute timeout (TERRAFORM_JOB = dispatch + executionTimeout;
     * CONDITION_CHECK = WAITING_EXTERNAL entry + ttl).
     */
    @Modifying
    @Query("update Task t set t.deadlineAt = :deadlineAt where t.id = :id")
    int setDeadlineAt(@Param("id") Long id, @Param("deadlineAt") Instant deadlineAt);
}
