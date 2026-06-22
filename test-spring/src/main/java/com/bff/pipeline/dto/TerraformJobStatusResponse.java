package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** IM terraform job status — status in {RUNNING, SUCCEEDED, FAILED}. */
@Getter
@Builder
public class TerraformJobStatusResponse {

    private final String status;
}
