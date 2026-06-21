package com.bff.pipeline.api;

import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;

import java.time.Instant;

/** API view of a task; {@code latestCheck} is the current observation run (max started_at), null if unobserved. */
public record TaskView(Long id, int seq, String name, String handlerKey, TaskKind kind, TaskStatus status,
                       int failCount, int maxFailCount, Instant nextCheckAt, CheckView latestCheck) {

    public static TaskView of(Task t, CheckView latestCheck) {
        return new TaskView(t.getId(), t.getSeq(), t.getName(), t.getHandlerKey(), t.getKind(), t.getStatus(),
                t.getFailCount(), t.getMaxFailCount(), t.getNextCheckAt(), latestCheck);
    }
}
