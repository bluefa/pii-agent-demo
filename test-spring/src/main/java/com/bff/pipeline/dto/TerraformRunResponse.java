package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** IM terraform run response — the server-issued job_id. */
@Getter
@Builder
public class TerraformRunResponse {

    private final String jobId;
}
