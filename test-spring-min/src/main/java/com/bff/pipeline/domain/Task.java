package com.bff.pipeline.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.lang.Nullable;

import java.time.Duration;
import java.time.Instant;

/**
 * One step of a pipeline's ordered chain (minimal-redesign.md §6). The row IS the task's whole state: its
 * {@link TaskStatus}, the dispatched {@code jobId} (TERRAFORM_JOB), the {@code failCount}, and on failure an
 * {@link ErrorCode}. The per-task knobs ({@code ttl / pollingInterval / executionTimeout / maxFailCount}) are
 * optional overrides; the reconciler falls back to the global {@code PipelineSettings} when one is null.
 */
@Entity
@Table(name = "task",
        uniqueConstraints = @UniqueConstraint(name = "uq_task_pipeline_seq", columnNames = {"pipelineId", "seq"}),
        indexes = @Index(name = "ix_task_pipeline_seq", columnList = "pipelineId, seq"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    @Column(nullable = false)
    private Long pipelineId;

    /** position in the chain; the lowest-seq non-terminal task is the pipeline's current task. */
    @Column(nullable = false)
    private int seq;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskKind kind;

    /** the IM operation this task runs (e.g. "apply-network", "network-ready"). */
    @Column(nullable = false)
    private String operation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    /** the IM-issued TERRAFORM_JOB handle, stored on dispatch and re-polled after a crash; null otherwise. */
    @Nullable
    private String jobId;

    @Column(nullable = false)
    private int failCount;

    /** the failure cause, set only when {@code status == FAILED}. */
    @Enumerated(EnumType.STRING)
    @Nullable
    private ErrorCode errorCode;

    @Nullable
    private Instant startedAt;
    @Nullable
    private Instant readyAt;
    @Nullable
    private Instant finishedAt;
    /** next poll/check due time (a CONDITION_CHECK reschedules this when not yet met). */
    @Nullable
    private Instant nextCheckAt;

    // ---- optional per-task knob overrides (null → the global PipelineSettings default) ----
    @JdbcTypeCode(SqlTypes.BIGINT)
    @Nullable
    private Duration ttl;
    @JdbcTypeCode(SqlTypes.BIGINT)
    @Nullable
    private Duration pollingInterval;
    @JdbcTypeCode(SqlTypes.BIGINT)
    @Nullable
    private Duration executionTimeout;
    @Nullable
    private Integer maxFailCount;

    /** optimistic lock — a cancel that commits during a slow IM call bumps this, so the in-flight reconcile's
     *  stale save is rejected rather than clobbering CANCELLED (the cancel-race guard). */
    @jakarta.persistence.Version
    @Nullable
    private Long version;
}
