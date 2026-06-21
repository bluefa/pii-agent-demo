package com.bff.pipeline.repo;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.TaskAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TaskAttemptRepository extends JpaRepository<TaskAttempt, Long> {

    /** the current (latest) attempt for a task. */
    Optional<TaskAttempt> findFirstByTaskIdOrderByAttemptNoDesc(Long taskId);

    List<TaskAttempt> findByTaskIdOrderByAttemptNoAsc(Long taskId);

    // ---- guarded CAS (explicit prior-state predicate; NOT @Version-as-CAS) ----

    /**
     * Response-adoption CAS (dispatch step 4b). Write-once the dispatch response, but ONLY while the
     * dispatch is still in flight. The guard is cross-row: the attempt must be open
     * ({@code response IS NULL AND finishedAt IS NULL}) AND its task must still be DISPATCHING. Once the
     * task leaves DISPATCHING (terminal, cancelled, recovered to a new attempt), a late response from the
     * old call matches 0 rows and is dropped — this is the late-response block. The DISPATCHING literal is
     * intentionally fixed in the predicate so the guard cannot be weakened by a caller-supplied status.
     *
     * @return 1 if adopted, 0 if blocked (already set / attempt finished / task no longer DISPATCHING).
     */
    @Modifying
    @Query("update TaskAttempt a set a.response = :response "
            + "where a.id = :attemptId and a.response is null and a.finishedAt is null "
            + "and exists (select 1 from Task t where t.id = a.taskId "
            + "and t.status = com.bff.pipeline.domain.TaskStatus.DISPATCHING)")
    int adoptResponseWhileDispatching(@Param("attemptId") Long attemptId,
                                      @Param("response") String response);

    /**
     * Close the attempt as failed: {@code result=FAIL, finishedAt, errorCode}, only if still open
     * ({@code finishedAt IS NULL}). Idempotent — a second close (e.g. drain after timeout) matches 0 rows.
     */
    @Modifying
    @Query("update TaskAttempt a set a.result = com.bff.pipeline.domain.AttemptResult.FAIL, "
            + "a.finishedAt = :now, a.errorCode = :errorCode "
            + "where a.id = :id and a.finishedAt is null")
    int closeFailed(@Param("id") Long id,
                    @Param("errorCode") ErrorCode errorCode,
                    @Param("now") Instant now);

    /**
     * Close the attempt as succeeded: {@code result=OK, finishedAt}, only if still open. errorCode stays
     * null (OK has no error). Idempotent against re-close.
     */
    @Modifying
    @Query("update TaskAttempt a set a.result = com.bff.pipeline.domain.AttemptResult.OK, "
            + "a.finishedAt = :now where a.id = :id and a.finishedAt is null")
    int closeOk(@Param("id") Long id, @Param("now") Instant now);
}
