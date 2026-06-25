package com.bff.pipeline.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * One pipeline run for one target (minimal-redesign.md §6). Per-target uniqueness while active is
 * enforced by the {@code active_target} generated column (= the target while non-terminal, NULL once terminal)
 * under a unique constraint, so a duplicate create collides only against a still-active run (§5).
 */
@Entity
@Table(name = "pipeline",
        uniqueConstraints = @UniqueConstraint(name = "uq_pipeline_active_target", columnNames = "active_target"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pipeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PipelineType type;

    @Column(nullable = false)
    private String target;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PipelineStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lastActivityAt;

    /**
     * = {@code target} while the pipeline is non-terminal, NULL once terminal — the unique key that admits one
     * active run per target. DB-generated and read-only; Hibernate never writes it.
     */
    @Column(name = "active_target", insertable = false, updatable = false,
            columnDefinition = "varchar(255) generated always as "
                    + "(case when status in ('DONE','FAILED','CANCELLED') then null else target end)")
    @Nullable
    private String activeTarget;
}
