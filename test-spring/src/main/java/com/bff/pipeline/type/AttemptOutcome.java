package com.bff.pipeline.type;

/** API view of a finished attempt's result (api §0): derived from {@code task_attempt.result + error_code}. */
public enum AttemptOutcome {
    SUCCEEDED,
    FAILED,
    EXECUTION_TIMEOUT
}
