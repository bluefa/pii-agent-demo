package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/** IM terraform job status — status in {RUNNING, SUCCEEDED, FAILED}. */
@Getter
@Builder
public class TerraformJobStatusResponse {

    @Nullable
    private final String status;
}
