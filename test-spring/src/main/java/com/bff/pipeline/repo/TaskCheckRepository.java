package com.bff.pipeline.repo;

import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.TaskCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

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

    /** Retention prune (Decision 1.3): drop CHECK/DISPATCH rows whose last observation is past retention. */
    @Modifying
    int deleteByCheckedAtBefore(Instant cutoff);
}
