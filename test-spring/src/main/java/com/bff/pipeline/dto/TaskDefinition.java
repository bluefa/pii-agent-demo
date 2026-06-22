package com.bff.pipeline.dto;

import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.service.handler.PipelineHandler;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * One task in a recipe (seq = its index in the chain). The duration knobs are frozen onto the task row
 * at creation; null means "use the global default". pollingInterval/ttl apply to CONDITION_CHECK,
 * executionTimeout to TERRAFORM_JOB. The handler is referenced by its concrete class (compile-time safe,
 * refactor-proof); creation resolves it to the stored String handler_key via {@code PipelineHandlerRegistry.keyOf}.
 */
@Getter
@Builder
public class TaskDefinition {

    private final String name;
    private final Class<? extends PipelineHandler> handlerClass;
    private final TaskKind kind;
    @Nullable
    private final Duration ttl;
    @Nullable
    private final Duration pollingInterval;
    @Nullable
    private final Duration executionTimeout;
    @Nullable
    private final Integer maxFailCount;

    public static TaskDefinition terraformJob(String name, Class<? extends PipelineHandler> handlerClass) {
        return TaskDefinition.builder()
                .name(name)
                .handlerClass(handlerClass)
                .kind(TaskKind.TERRAFORM_JOB)
                .build();
    }

    public static TaskDefinition conditionCheck(String name, Class<? extends PipelineHandler> handlerClass) {
        return TaskDefinition.builder()
                .name(name)
                .handlerClass(handlerClass)
                .kind(TaskKind.CONDITION_CHECK)
                .build();
    }
}
