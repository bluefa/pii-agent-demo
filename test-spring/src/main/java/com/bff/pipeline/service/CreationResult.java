package com.bff.pipeline.service;

import com.bff.pipeline.domain.Pipeline;

/**
 * Outcome of creation: the run, and whether it was newly created. {@code created == false} means an
 * existing non-terminal run for the target was returned instead (the idempotent creation contract).
 */
public record CreationResult(Pipeline pipeline, boolean created) {
}
