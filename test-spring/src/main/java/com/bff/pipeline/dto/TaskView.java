package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/** API view of a task; {@code latestCheck} is the current observation run (max started_at), null if unobserved. */
@Getter
@Builder
public class TaskView {

    private final Long id;
    private final int seq;
    private final String name;
    private final String handlerKey;
    private final TaskKind kind;
    private final TaskStatus status;
    private final int failCount;
    private final int maxFailCount;
    @Nullable
    private final Instant nextCheckAt;
    @Nullable
    private final CheckView latestCheck;

    public static TaskView of(Task t, @Nullable CheckView latestCheck) {
        return TaskView.builder()
                .id(t.getId())
                .seq(t.getSeq())
                .name(t.getName())
                .handlerKey(t.getHandlerKey())
                .kind(t.getKind())
                .status(t.getStatus())
                .failCount(t.getFailCount())
                .maxFailCount(t.getMaxFailCount())
                .nextCheckAt(t.getNextCheckAt())
                .latestCheck(latestCheck)
                .build();
    }
}
