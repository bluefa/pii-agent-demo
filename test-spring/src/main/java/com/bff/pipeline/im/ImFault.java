package com.bff.pipeline.im;

import java.time.Duration;

/**
 * Classified IM call failure — the distinction the ADR's backpressure/non-accrual paths depend on, so
 * the handler surfaces it explicitly rather than the reconciler inferring it.
 */
public sealed interface ImFault {

    /** 429/503 — not a failure; retryAfter may be null (then next tick / kind cadence). */
    record Backpressure(Duration retryAfter) implements ImFault {}

    /** the single call timed out -> CALL_TIMEOUT. */
    record Timeout() implements ImFault {}

    /** any other non-backpressure error -> IM_REJECTED (dispatch) / CHECK_ERROR (poll/check). */
    record HardError(String detail) implements ImFault {}
}
