package com.bff.pipeline.exception;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * Classified IM call failure — the distinction the ADR's backpressure/non-accrual paths depend on, so
 * the handler surfaces it explicitly rather than the reconciler inferring it.
 */
public sealed interface ImFault {

    /** 429/503 — not a failure; retryAfter may be null (then next tick / kind cadence). */
    @Getter
    @Builder
    final class Backpressure implements ImFault {
        @Nullable
        private final Duration retryAfter;
    }

    /** the single call timed out -> CALL_TIMEOUT. */
    final class Timeout implements ImFault {}

    /** any other non-backpressure error -> IM_REJECTED (dispatch) / CHECK_ERROR (poll/check). */
    @Getter
    @Builder
    final class HardError implements ImFault {
        private final String detail;
    }
}
