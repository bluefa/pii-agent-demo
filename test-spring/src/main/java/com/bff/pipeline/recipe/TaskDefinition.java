package com.bff.pipeline.recipe;

import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.handler.PipelineHandler;

import java.time.Duration;

/**
 * One task in a recipe (seq = its index in the chain). The duration knobs are frozen onto the task row
 * at creation; null means "use the global default". pollingInterval/ttl apply to CONDITION_CHECK,
 * executionTimeout to TERRAFORM_JOB. The handler is referenced by its concrete class (compile-time safe,
 * refactor-proof); creation resolves it to the stored String handler_key via {@code HandlerRegistry.keyOf}.
 */
public record TaskDefinition(
        String name,
        Class<? extends PipelineHandler> handlerClass,
        TaskKind kind,
        Duration ttl,
        Duration pollingInterval,
        Duration executionTimeout,
        Integer maxFailCount
) {
    public static TaskDefinition terraformJob(String name, Class<? extends PipelineHandler> handlerClass) {
        return new TaskDefinition(name, handlerClass, TaskKind.TERRAFORM_JOB, null, null, null, null);
    }

    public static TaskDefinition conditionCheck(String name, Class<? extends PipelineHandler> handlerClass) {
        return new TaskDefinition(name, handlerClass, TaskKind.CONDITION_CHECK, null, null, null, null);
    }
}
