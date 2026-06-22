package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** Input to a CONDITION_CHECK — the execution unit only. */
@Getter
@Builder
public class ConditionCheckContext {

    private final String targetSourceId;
}
