package com.bff.pipeline.service;

import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;

/**
 * One CHECK observation as the RLE collapse key (state-machine §RLE): consecutive identical
 * {@code (apiResult, observed, errorCode)} fold into the open run; a change starts a new run. {@code observed}
 * is null for ERROR/backpressure; {@code errorCode} is the bucket-② code (CHECK_ERROR / CALL_TIMEOUT) or null
 * — a {@code (ERROR, null, null)} observation is the backpressure marker (no reason code).
 */
record Observation(ApiResult apiResult, Observed observed, ErrorCode errorCode) {
}
