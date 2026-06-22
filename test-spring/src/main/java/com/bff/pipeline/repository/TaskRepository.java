package com.bff.pipeline.repository;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByPipelineIdOrderBySeqAsc(Long pipelineId);

    /** A single task by its chain position — the tick reads the predecessor (seq-1) fresh so a same-tick
     *  predecessor DONE promotes its successor BLOCKED → READY (same-tick convergence). */
    Optional<Task> findByPipelineIdAndSeq(Long pipelineId, int seq);

    /** QUEUE_WAIT alert input (V1 dwell proxy): is a TERRAFORM_JOB still READY (slot-queued) on a pipeline that
     *  started before the threshold? Cross-entity join on pipelineId (no JPA association is mapped). */
    @Query("select case when count(t) > 0 then true else false end from Task t, com.bff.pipeline.entity.Pipeline p "
            + "where t.pipelineId = p.id and t.kind = com.bff.pipeline.type.TaskKind.TERRAFORM_JOB "
            + "and t.status = com.bff.pipeline.type.TaskStatus.READY and p.startedAt <= :threshold")
    boolean existsSlotQueuedTaskStartedBefore(@Param("threshold") Instant threshold);

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

    /** Set fail_count to an absolute value — the tick recomputes CONDITION_CHECK fail_count from the durable
     *  task_check ledger (rollback-safe accounting; see TaskCheckRepository.sumConditionCheckFailures). */
    @Modifying
    @Query("update Task t set t.failCount = :count where t.id = :id")
    int setFailCount(@Param("id") Long id, @Param("count") int count);

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
