package com.bff.pipeline.handler;

import java.time.Duration;

/**
 * Result of a TERRAFORM_JOB dispatch call. Backpressure (429/503) is NOT a failure: fail_count is not
 * consumed and the same logical attempt is reused. CallTimeout/Rejected attribute to the attempt.
 */
public sealed interface DispatchOutcome {

    /** dispatch accepted; handle (job_id) returned. Adopted into attempt.response (write-once). */
    record Accepted(String handle) implements DispatchOutcome {}

    /** IM hard-rejected (non-backpressure) -> IM_REJECTED, attempt fail. */
    record Rejected(String detail) implements DispatchOutcome {}

    /** 429/503 -> not a failure; retryAfter may be null (then next tick). */
    record Backpressure(Duration retryAfter) implements DispatchOutcome {}

    /** the single call timed out -> CALL_TIMEOUT; DISPATCHING held, recovery decides the attempt's fate. */
    record CallTimeout() implements DispatchOutcome {}
}
