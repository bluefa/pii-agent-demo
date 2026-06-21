package com.bff.pipeline.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Duration;
import java.time.Instant;

/**
 * task — one step of a pipeline's sequential chain. The reconciler advances tasks; the slot-queue wait
 * is {@code READY && kind==TERRAFORM_JOB} (no WAITING_SLOT state).
 *
 * <p>Duration knobs (pollingInterval, ttl, executionTimeout, maxFailCount) are frozen from the recipe
 * at creation (Decision 7.3). deadlineAt is a reconciler-derived absolute timestamp.
 */
@Entity
@Table(name = "task",
        uniqueConstraints = @UniqueConstraint(name = "uq_task_pipeline_seq", columnNames = {"pipelineId", "seq"}),
        indexes = @Index(name = "ix_task_pipeline_seq", columnList = "pipelineId, seq"))
@Getter
@Setter
@NoArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long pipelineId;

    @Column(nullable = false)
    private int seq;

    /** display label only (UX) — routing is by handlerKey. */
    @Column(nullable = false)
    private String name;

    /** stable code-class identifier (e.g. "aws.tf.network"); reconciler routes by this. */
    @Column(nullable = false)
    private String handlerKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    // ---- frozen recipe knobs (snapshot.spec); Duration stored as BIGINT nanoseconds (matches schema-postgres.sql,
    //      explicit so ddl-auto=validate agrees instead of relying on Hibernate's default numeric mapping) ----
    /** CONDITION_CHECK only (>=10m guard); null for TERRAFORM_JOB (uses system job-poll cadence). */
    @JdbcTypeCode(SqlTypes.BIGINT)
    private Duration pollingInterval;
    /** CONDITION_CHECK total-residence TTL. */
    @JdbcTypeCode(SqlTypes.BIGINT)
    private Duration ttl;
    /** TERRAFORM_JOB dispatch->terminal execution timeout. */
    @JdbcTypeCode(SqlTypes.BIGINT)
    private Duration executionTimeout;

    @Column(nullable = false)
    private int maxFailCount;

    @Column(nullable = false)
    private int failCount;

    // ---- reconciler-managed scheduling/derived ----
    /** next poll/check due time (scheduling hint, not a state transition). */
    private Instant nextCheckAt;
    /** last time the tick serviced (fired for) this task — starvation-avoidance sort key. */
    private Instant lastCheckedAt;
    /** absolute expiry of the currently-applied timeout (derived). */
    private Instant deadlineAt;

    /** first execution start = READY -> DISPATCHING / READY -> WAITING_EXTERNAL (not BLOCKED -> READY). */
    private Instant startedAt;
    private Instant finishedAt;

    @Version
    private Long version;
}
