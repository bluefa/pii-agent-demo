package com.bff.pipeline.dto;

import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * Result of a CONDITION_CHECK condition check. observed in {MET, NOT_MET}. NOT_MET is not a failure
 * ("yet"). A non-backpressure CallFailed (CHECK_ERROR / CALL_TIMEOUT) DOES consume fail_count.
 */
public sealed interface ConditionCheckOutcome {

    @Getter
    @Builder
    final class Condition implements ConditionCheckOutcome {
        private final Observed observed;
    }

    @Getter
    @Builder
    final class Backpressure implements ConditionCheckOutcome {
        @Nullable
        private final Duration retryAfter;
    }

    /** reason in {CHECK_ERROR, CALL_TIMEOUT}. */
    @Getter
    @Builder
    final class CallFailed implements ConditionCheckOutcome {
        private final ErrorCode reason;
    }
}
