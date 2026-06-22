package com.bff.pipeline.entity;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * task_check — the ledger of external-call observations (RLE, follow-up 17):
 * <ul>
 *   <li>DISPATCH: 1 row per dispatch call (no collapse, poll_count=1; D-T5 PENDING pre-record).</li>
 *   <li>CHECK: 1 row per <em>observation run</em> — consecutive identical (apiResult, observed, errorCode)
 *       collapse into the open run with poll_count++ (partition = task_id+kind+name+external_handle).</li>
 * </ul>
 * Errors stored here: CHECK_ERROR, CALL_TIMEOUT, and the synthetic HANDLER_NOT_FOUND row.
 */
@Entity
@Table(name = "task_check",
        indexes = @Index(name = "ix_check_task_started", columnList = "taskId, startedAt"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    /**
     * The attempt this observation belongs to (DISPATCH rows + TERRAFORM_JOB poll runs); null for
     * CONDITION_CHECK checks and tick-synthetic rows (no attempt). The tick correlates a committed
     * observation to the CURRENT attempt by this id — clock-independent, so a stale prior-attempt
     * observation is never mistaken for the current one even if the wall clock steps backward.
     */
    @Nullable
    private Long attemptId;

    /** run first-fire time (CHECK) / call-fire time (DISPATCH). Sort + latestCheck key. */
    @Nullable
    private Instant startedAt;
    /** run last-observation time (null while DISPATCH PENDING). */
    @Nullable
    private Instant checkedAt;

    /** polls folded into this run (DISPATCH=1). */
    @Column(nullable = false)
    private int pollCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CheckKind kind;

    /** call operation identifier (e.g. "im.terraformApply", "im.jobStatus"). */
    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApiResult apiResult;

    /** raw observation; null for DISPATCH (dispatch success authority is apiResult + attempt.response). */
    @Enumerated(EnumType.STRING)
    @Nullable
    private Observed observed;

    @Enumerated(EnumType.STRING)
    @Nullable
    private ErrorCode errorCode;

    /** last poll's latency (overwritten, not accumulated); null when unobserved. */
    @Nullable
    private Long latencyMs;

    /** reference to the confirmed id (home is attempt.response; not a handle store). */
    @Nullable
    private String externalHandle;
}
