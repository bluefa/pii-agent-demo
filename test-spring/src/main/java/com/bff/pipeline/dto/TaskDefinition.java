package com.bff.pipeline.dto;

import com.bff.pipeline.type.TaskKind;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * One task in a recipe (seq = its index in the chain). The duration knobs are frozen onto the task row
 * at creation; null means "use the global default". pollingInterval/ttl apply to CONDITION_CHECK,
 * executionTimeout to TERRAFORM_JOB. {@code operation} is the IM operation this task runs — fixed in the
 * recipe and frozen onto the task row; the launcher selects the IM call by {@code (kind, operation)}.
 */
@Getter
@Builder
public class TaskDefinition {

    private final String name;
    private final String operation;
    private final TaskKind kind;
    @Nullable
    private final Duration ttl;
    @Nullable
    private final Duration pollingInterval;
    @Nullable
    private final Duration executionTimeout;
    @Nullable
    private final Integer maxFailCount;

    public static TaskDefinition terraformJob(String name, String operation) {
        return TaskDefinition.builder()
                .name(name)
                .operation(operation)
                .kind(TaskKind.TERRAFORM_JOB)
                .build();
    }

    public static TaskDefinition conditionCheck(String name, String operation) {
        return TaskDefinition.builder()
                .name(name)
                .operation(operation)
                .kind(TaskKind.CONDITION_CHECK)
                .build();
    }
}
