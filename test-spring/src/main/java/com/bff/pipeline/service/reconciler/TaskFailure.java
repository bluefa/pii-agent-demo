package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.type.ErrorCode;
import lombok.Builder;
import lombok.Getter;

/**
 * One attempt failure the tick is closing (dispatch reject/recovery or a RUNNING job failure): the owning
 * pipeline and task, the attempt to close, and the {@link ErrorCode} cause. Built and consumed inside the
 * tick's state-transition transaction, so it holds live JPA entities (never crosses the async boundary).
 */
@Getter
@Builder
class TaskFailure {

    private final Pipeline pipeline;
    private final Task task;
    private final TaskAttempt attempt;
    private final ErrorCode reason;
}
