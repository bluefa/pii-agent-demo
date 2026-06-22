package com.bff.pipeline.dto;

import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * One CHECK observation as the RLE collapse key (state-machine §RLE): consecutive identical
 * {@code (apiResult, observed, errorCode)} fold into the open run; a change starts a new run. {@code observed}
 * is null for ERROR/backpressure; {@code errorCode} is the bucket-② code (CHECK_ERROR / CALL_TIMEOUT) or null
 * — a {@code (ERROR, null, null)} observation is the backpressure marker (no reason code).
 */
@Getter
@Builder
public class TaskCheckObservation {

    private final ApiResult apiResult;
    @Nullable
    private final Observed observed;
    @Nullable
    private final ErrorCode errorCode;
}
