package com.bff.pipeline.entity;
import com.bff.pipeline.type.AttemptResult;
import com.bff.pipeline.type.ErrorCode;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * task_attempt — the lifecycle of one dispatch action (one row per dispatch; TERRAFORM_JOB only).
 * Created at dispatch (READY->DISPATCHING) and stays incomplete during RUNNING: result/finishedAt/
 * errorCode are null until terminal; response is set after the dispatch response.
 *
 * <p>EXECUTION_TIMEOUT is {@code result=FAIL + errorCode=EXECUTION_TIMEOUT} (no separate result value).
 * response is the write-once jsonb home of the handle ({"job_id": ...}); modeled as a JSON String here
 * (no dedicated terraform_job_id column, by design).
 */
@Entity
@Table(name = "task_attempt",
        indexes = @Index(name = "ix_attempt_task", columnList = "taskId, attemptNo"))
@Getter
@Setter
@NoArgsConstructor
public class TaskAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    /** "n-th try" (1-based). 429/503 backpressure reuses the same logical attempt (no new row). */
    @Column(nullable = false)
    private int attemptNo;

    @Nullable
    private Instant startedAt;
    @Nullable
    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Nullable
    private AttemptResult result;

    @Enumerated(EnumType.STRING)
    @Nullable
    private ErrorCode errorCode;

    @Nullable
    private String errorDetail;

    /** dispatch raw response (write-once jsonb home of the handle, e.g. {"job_id":"..."}). */
    @Column(length = 2000)
    @Nullable
    private String response;
}
