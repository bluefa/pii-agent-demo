package com.bff.pipeline.service.handler;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;

import com.bff.pipeline.type.TaskKind;

/**
 * A CONDITION_CHECK handler: no dispatch; repeatedly read an external condition until MET. No attempt,
 * no slot. "Not yet" (NOT_MET) is not a failure.
 */
public interface ConditionCheckHandler extends PipelineHandler {

    @Override
    default TaskKind kind() {
        return TaskKind.CONDITION_CHECK;
    }

    ConditionCheckOutcome check(ConditionCheckContext ctx);
}
