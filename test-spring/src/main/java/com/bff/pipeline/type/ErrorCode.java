package com.bff.pipeline.type;

/**
 * errorCode catalog (8). Storage location is one of three (api §0):
 * <ol>
 *   <li>attempt-attributed (task_attempt.error_code): EXECUTION_TIMEOUT, DISPATCH_NO_RESPONSE,
 *       IM_REJECTED, JOB_FAILED.</li>
 *   <li>task_check observation (task_check.error_code): CHECK_ERROR, CALL_TIMEOUT.</li>
 *   <li>tick-derived: TTL_EXPIRED (from status=EXPIRED; no row), HANDLER_NOT_FOUND (synthetic task_check row).</li>
 * </ol>
 */
public enum ErrorCode {
    /** Any single call timed out (dispatch/poll/check). One call failure, not an attempt failure. */
    CALL_TIMEOUT,
    /** TERRAFORM_JOB never reached terminal within execution timeout. */
    EXECUTION_TIMEOUT,
    /** WAIT_EXTERNAL TTL exceeded (derived from status=EXPIRED; never stored on a row). */
    TTL_EXPIRED,
    /** dispatch hard-rejected (non-backpressure). */
    IM_REJECTED,
    /** condition check observation failed (non-backpressure). */
    CHECK_ERROR,
    /** dispatch response never persisted by dispatch_recovery_timeout. */
    DISPATCH_NO_RESPONSE,
    /** handler_key failed to resolve in the registry -> immediate FAILED, fail_count NOT consumed. */
    HANDLER_NOT_FOUND,
    /** TERRAFORM_JOB poll observed the job itself FAILED. */
    JOB_FAILED
}
