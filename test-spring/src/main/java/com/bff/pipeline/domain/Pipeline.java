package com.bff.pipeline.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * pipeline — one install/delete run for a single target_source_id (1 pipeline : 1 target).
 * Status is derived from task states by the reconciler, except RUNNING -> CANCELLING (Admin API).
 *
 * <p>{@code @Version} is the JPA realization of the ADR's CAS (guarded write): a concurrent writer
 * loses with an optimistic-lock failure. Transition preconditions (e.g. cancel requires prior=RUNNING)
 * are additionally checked in app logic so terminal revival is a no-op.
 *
 * <p>fail_reason is jsonb {task_id, error_code} in the canonical schema; denormalized to two columns
 * here. Null on CANCELLED/DONE/RUNNING; set only on FAILED convergence.
 */
@Entity
@Table(name = "pipeline",
        indexes = {
                @Index(name = "ix_pipeline_target_started", columnList = "targetSourceId, startedAt"),
                @Index(name = "ix_pipeline_started", columnList = "startedAt"),
                @Index(name = "ix_pipeline_last_activity", columnList = "lastActivityAt")
        })
@Getter
@Setter
@NoArgsConstructor
public class Pipeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String targetSourceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PipelineType type;

    /** provider — enum not pinned (CloudProvider domain: AWS/AZURE/GCP/IDC/SDU). */
    @Column(nullable = false)
    private String provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PipelineStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Actor triggeredBy;

    /** RUNNING entry = creation time (created_at == started_at since creation is immediately RUNNING). */
    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;

    /** last state-transition time (task or pipeline). Board default sort key. */
    private Instant lastActivityAt;

    /** fail_reason.task_id — the FAILED/EXPIRED task that converged the pipeline. */
    private Long failReasonTaskId;

    /** fail_reason.error_code — that task's canonical errorCode. */
    @Enumerated(EnumType.STRING)
    private ErrorCode failReasonErrorCode;

    @Version
    private Long version;
}
