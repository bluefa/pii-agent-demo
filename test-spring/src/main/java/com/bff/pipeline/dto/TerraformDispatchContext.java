package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** Input to a TERRAFORM_JOB dispatch — the execution unit only (Decision 2). */
@Getter
@Builder
public class TerraformDispatchContext {

    private final String targetSourceId;
}
