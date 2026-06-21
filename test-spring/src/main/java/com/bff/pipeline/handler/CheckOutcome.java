package com.bff.pipeline.handler;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;

import java.time.Duration;

/**
 * Result of a CONDITION_CHECK condition check. observed in {MET, NOT_MET}. NOT_MET is not a failure
 * ("yet"). A non-backpressure CallFailed (CHECK_ERROR / CALL_TIMEOUT) DOES consume fail_count.
 */
public sealed interface CheckOutcome {

    record Condition(Observed observed) implements CheckOutcome {}

    record Backpressure(Duration retryAfter) implements CheckOutcome {}

    /** reason in {CHECK_ERROR, CALL_TIMEOUT}. */
    record CallFailed(ErrorCode reason) implements CheckOutcome {}
}
