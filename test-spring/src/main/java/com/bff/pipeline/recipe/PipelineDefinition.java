package com.bff.pipeline.recipe;

import com.bff.pipeline.domain.PipelineType;

import java.util.List;

/**
 * A code-default recipe — the versioned, sequential task chain for a (type, provider). One default
 * release per (type, provider); the run's execution config is frozen into pipeline_def_snapshot at
 * creation. Code = execution authority, snapshot = history authority.
 */
public record PipelineDefinition(
        String definitionKey,
        String version,
        PipelineType type,
        String provider,
        List<TaskDefinition> tasks
) {
    public PipelineDefinition {
        tasks = List.copyOf(tasks);
    }
}
