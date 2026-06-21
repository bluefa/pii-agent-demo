package com.bff.pipeline.recipe;

import com.bff.pipeline.domain.TaskKind;

import java.time.Duration;

/**
 * One task in a recipe (seq = its index in the chain). The duration knobs are frozen onto the task row
 * at creation; null means "use the global default". pollingInterval/ttl apply to CONDITION_CHECK,
 * executionTimeout to TERRAFORM_JOB. handlerKey must resolve in the registry (boot-asserted).
 */
public record TaskDefinition(
        String name,
        String handlerKey,
        TaskKind kind,
        Duration ttl,
        Duration pollingInterval,
        Duration executionTimeout,
        Integer maxFailCount
) {
    public static TaskDefinition terraformJob(String name, String handlerKey) {
        return new TaskDefinition(name, handlerKey, TaskKind.TERRAFORM_JOB, null, null, null, null);
    }

    public static TaskDefinition conditionCheck(String name, String handlerKey) {
        return new TaskDefinition(name, handlerKey, TaskKind.CONDITION_CHECK, null, null, null, null);
    }
}
