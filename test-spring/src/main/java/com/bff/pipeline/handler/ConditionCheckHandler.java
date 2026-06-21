package com.bff.pipeline.handler;

import com.bff.pipeline.domain.TaskKind;

/**
 * A CONDITION_CHECK handler: no dispatch; repeatedly read an external condition until MET. No attempt,
 * no slot. "Not yet" (NOT_MET) is not a failure.
 */
public interface ConditionCheckHandler extends PipelineHandler {

    @Override
    default TaskKind kind() {
        return TaskKind.CONDITION_CHECK;
    }

    CheckOutcome check(CheckContext ctx);
}
