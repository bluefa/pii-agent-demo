package com.bff.pipeline.repo;

import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.TaskCheck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskCheckRepository extends JpaRepository<TaskCheck, Long> {

    /**
     * The current open CHECK run for RLE collapse — the latest row within the partition
     * (taskId, kind, name, externalHandle). Consecutive identical (apiResult, observed, errorCode)
     * fold into this run (poll_count++); a changed observation starts a new run.
     */
    Optional<TaskCheck> findFirstByTaskIdAndKindAndNameAndExternalHandleOrderByStartedAtDesc(
            Long taskId, CheckKind kind, String name, String externalHandle);

    /** latestCheck = the task_check with max started_at (the current open run). */
    Optional<TaskCheck> findFirstByTaskIdOrderByStartedAtDesc(Long taskId);

    List<TaskCheck> findByTaskIdOrderByStartedAtAsc(Long taskId);
}
