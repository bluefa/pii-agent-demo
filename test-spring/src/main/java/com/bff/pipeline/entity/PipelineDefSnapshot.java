package com.bff.pipeline.entity;
import com.bff.pipeline.type.PipelineType;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * pipeline_def_snapshot — the run's frozen execution definition (Decision 7). Write-once, 1 pipeline : 1 row.
 * Code = execution authority; snapshot = history/reproduction authority. spec is the resolved full recipe
 * (jsonb), modeled as a JSON String here. pipeline.definition_version is NOT kept — the version lives only here.
 */
@Entity
@Table(name = "pipeline_def_snapshot")
@Getter
@Setter
@NoArgsConstructor
public class PipelineDefSnapshot {

    /** PK == pipeline.id (1:1, write-once). */
    @Id
    private Long pipelineId;

    @Column(nullable = false)
    private String definitionKey;

    @Column(nullable = false)
    private String definitionVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PipelineType type;

    @Column(nullable = false)
    private String provider;

    /** resolved full recipe: { name, tasks:[{ seq, handler_key, name, kind, ttl?, polling_interval?,
     *  execution_timeout?, max_fail_count }] } — jsonb in the canonical schema. */
    @Column(length = 4000, nullable = false)
    private String spec;
}
