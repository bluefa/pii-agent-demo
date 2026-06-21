package com.bff.pipeline.handler;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;

import java.time.Duration;

/**
 * Result of a TERRAFORM_JOB job poll. observed in {RUNNING, SUCCEEDED, FAILED}. A poll <em>read</em>
 * failure (CallFailed) does NOT consume fail_count (job not read != job failed) — only an observed
 * FAILED (JOB_FAILED) or execution timeout does.
 */
public sealed interface PollOutcome {

    record Status(Observed observed) implements PollOutcome {}

    record Backpressure(Duration retryAfter) implements PollOutcome {}

    /** reason in {CHECK_ERROR, CALL_TIMEOUT}. */
    record CallFailed(ErrorCode reason) implements PollOutcome {}
}
