package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/** Input to a TERRAFORM_JOB poll — the execution unit and the handle from attempt.response. */
@Getter
@Builder
public class TerraformPollContext {

    private final String targetSourceId;
    /** the adopted handle from {@code attempt.response}; null-typed source (set once dispatch is adopted). */
    @Nullable
    private final String handle;
}
