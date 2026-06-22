package com.bff.pipeline.dto;

import com.bff.pipeline.service.handler.ConditionCheckHandler;
import lombok.Builder;
import lombok.Getter;

/**
 * Scalars captured for a CONDITION_CHECK call that runs on the fire-and-forget pool. Crosses the async
 * boundary, so it holds only scalars + the stateless handler ref — never a detached JPA entity (§3 /
 * D-T4 discipline). A condition check has no attempt and no handle (the MET/EXPIRED read is unscoped).
 */
@Getter
@Builder
public class ConditionCheckCommand {

    private final long taskId;
    private final ConditionCheckHandler handler;
    private final String targetSourceId;
    private final String name;
}
