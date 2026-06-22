package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Pipeline;
import lombok.Builder;
import lombok.Getter;

/**
 * Outcome of creation: the run, and whether it was newly created. {@code created == false} means an
 * existing non-terminal run for the target was returned instead (the idempotent creation contract).
 */
@Getter
@Builder
public class PipelineCreationResult {

    private final Pipeline pipeline;
    private final boolean created;
}
