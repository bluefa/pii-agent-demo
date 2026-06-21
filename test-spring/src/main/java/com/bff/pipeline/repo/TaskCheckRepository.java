package com.bff.pipeline.repo;

import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.TaskCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TaskCheckRepository extends JpaRepository<TaskCheck, Long> {

    /**
     * The current open CHECK run for RLE collapse — the latest row within the partition
     * (taskId, kind, name, externalHandle). Consecutive identical (apiResult, observed, errorCode)
     * fold into this run (poll_count++); a changed observation starts a new run.
     */
    Optional<TaskCheck> findFirstByTaskIdAndKindAndNameAndExternalHandleOrderByStartedAtDescIdDesc(
            Long taskId, CheckKind kind, String name, String externalHandle);

    /** latestCheck = the task_check with max started_at (the current open run); id breaks started_at ties
     *  so the *latest-inserted* run wins when a fixed clock / same-instant inserts collide. */
    Optional<TaskCheck> findFirstByTaskIdOrderByStartedAtDescIdDesc(Long taskId);

    /**
     * The latest row of one kind for a task — the tick's DISPATCH-recovery backpressure-hold reads the
     * latest DISPATCH observation (api_result=ERROR, error_code=null = backpressure => hold, no fail).
     */
    Optional<TaskCheck> findFirstByTaskIdAndKindOrderByStartedAtDescIdDesc(Long taskId, CheckKind kind);

    List<TaskCheck> findByTaskIdOrderByStartedAtAsc(Long taskId);

    /** Paged checks for the task timeline (api §1). */
    org.springframework.data.domain.Page<TaskCheck> findByTaskId(
            Long taskId, org.springframework.data.domain.Pageable pageable);

    /**
     * CONDITION_CHECK fail accounting (state-machine 95: "실패한 CHECK 호출 수"): the total of non-backpressure
     * CHECK error CALLS = SUM(poll_count) over the CHECK error runs (errorCode = CHECK_ERROR | CALL_TIMEOUT;
     * backpressure errorCode is null and excluded). The tick recomputes fail_count from this durable ledger so
     * a committed failed call is never lost to a rolled-back fail++ (and never double-counted — it is a sum).
     */
    @Query("select coalesce(sum(c.pollCount), 0) from TaskCheck c where c.taskId = :taskId "
            + "and c.kind = com.bff.pipeline.domain.CheckKind.CHECK "
            + "and c.apiResult = com.bff.pipeline.domain.ApiResult.ERROR "
            + "and c.errorCode in (com.bff.pipeline.domain.ErrorCode.CHECK_ERROR, com.bff.pipeline.domain.ErrorCode.CALL_TIMEOUT)")
    long sumConditionCheckFailures(@Param("taskId") Long taskId);

    /** Retention prune (Decision 1.3): drop CHECK/DISPATCH rows whose last observation is past retention. */
    @Modifying
    int deleteByCheckedAtBefore(Instant cutoff);
}
