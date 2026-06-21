package com.bff.pipeline.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * pipeline_event — append-only audit log AND notification outbox (transactional outbox): written in the
 * same tx as the state change, so no loss. pipelineId is nullable (global events e.g. settings change).
 * payload is jsonb (modeled as a JSON String); the API {@code message} is rendered from it.
 * notifiedAt IS NULL = unsent (the Notifier's outbox cursor).
 */
@Entity
@Table(name = "pipeline_event",
        indexes = @Index(name = "ix_event_pipeline_created", columnList = "pipelineId, createdAt"))
@Getter
@Setter
@NoArgsConstructor
public class PipelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** nullable — global (non-pipeline) events have pipelineId = null. */
    private Long pipelineId;

    private Long taskId;

    @Column(nullable = false)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severity severity;

    @Column(length = 2000)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Actor actor;

    @Column(nullable = false)
    private Instant createdAt;

    /** stamped by the Notifier on send; IS NULL = unsent. */
    private Instant notifiedAt;
}
