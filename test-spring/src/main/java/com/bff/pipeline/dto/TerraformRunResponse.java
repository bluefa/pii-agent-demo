package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/** IM terraform run response — the server-issued job_id. */
@Getter
@Builder
public class TerraformRunResponse {

    @Nullable
    private final String jobId;
}
