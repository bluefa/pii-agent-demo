package com.bff.pipeline.dto;

import com.bff.pipeline.type.PipelineType;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * A code-default recipe — the versioned, sequential task chain for a (type, provider). One default
 * release per (type, provider); the run's execution config is frozen into pipeline_def_snapshot at
 * creation. Code = execution authority, snapshot = history authority.
 */
@Getter
public class PipelineDefinition {

    private final String definitionKey;
    private final String version;
    private final PipelineType type;
    private final String provider;
    private final List<TaskDefinition> tasks;

    @Builder
    PipelineDefinition(String definitionKey, String version, PipelineType type, String provider,
                       List<TaskDefinition> tasks) {
        this.definitionKey = definitionKey;
        this.version = version;
        this.type = type;
        this.provider = provider;
        this.tasks = List.copyOf(tasks);
    }
}
