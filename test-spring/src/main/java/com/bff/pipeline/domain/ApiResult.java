package com.bff.pipeline.domain;

/** task_check.api_result — the call outcome. PENDING is the DISPATCH pre-record (attempted, unknown). */
public enum ApiResult {
    PENDING,
    OK,
    ERROR
}
