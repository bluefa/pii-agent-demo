package com.bff.pipeline.create;

import com.bff.pipeline.domain.TaskKind;

import java.util.List;

/**
 * The ordered task chain for a {@code PipelineType} (minimal-redesign.md §1). Each {@link Step} names a task
 * kind and the IM operation it runs; the creator materializes one task per step in order.
 */
public record Recipe(List<Step> steps) {

    public record Step(TaskKind kind, String operation) {

        public static Step terraform(String operation) {
            return new Step(TaskKind.TERRAFORM_JOB, operation);
        }

        public static Step condition(String operation) {
            return new Step(TaskKind.CONDITION_CHECK, operation);
        }
    }
}
