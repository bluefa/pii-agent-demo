package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** IM terraform run request (example). */
@Getter
@Builder
public class TerraformRunRequest {

    private final String targetSourceId;
    private final String operation;
}
