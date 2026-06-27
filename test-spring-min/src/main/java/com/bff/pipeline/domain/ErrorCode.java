package com.bff.pipeline.domain;

/**
 * Why a task FAILED (minimal-redesign.md §7) — each a real, distinct cause, never compressed into one. The
 * timeout/expiry flavors are folded into FAILED + this code rather than into separate task states.
 */
public enum ErrorCode {
    /** a TERRAFORM_JOB poll reported the job FAILED. */
    JOB_FAILED,
    /** a TERRAFORM_JOB ran past its executionTimeout without finishing. */
    EXECUTION_TIMEOUT,
    /** a CONDITION_CHECK never met its condition within ttl. */
    TTL_EXPIRED,
    /** a poll/check call returned an error verdict (a read failure, not a job failure). */
    CHECK_ERROR,
    /** a single IM dispatch/poll call exceeded the per-call timeout. */
    CALL_TIMEOUT
}
