package com.bff.pipeline.domain;

/**
 * task_attempt.result — the attempt's terminal result (NOT the dispatch-accepted flag). EXECUTION_TIMEOUT
 * is not a separate value; it is {@code result=FAIL + error_code=EXECUTION_TIMEOUT} (S30, option B).
 */
public enum AttemptResult {
    OK,
    FAIL
}
