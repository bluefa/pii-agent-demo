package com.bff.pipeline.util;

import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * Pure backpressure-backoff math. A BACKPRESSURE Retry-After is honoured only when it exceeds the phase's
 * cadence floor; otherwise the floor wins (so a condition/job is not hammered below its guard). Dispatch has no
 * cadence floor, so a null Retry-After there defers to the supplied default (the tick interval).
 */
public final class Backoff {

    private Backoff() {
    }

    /** The larger of the Retry-After and the cadence floor (the floor when Retry-After is null or shorter). */
    public static Duration atLeast(@Nullable Duration retryAfter, Duration floor) {
        return retryAfter != null && retryAfter.compareTo(floor) > 0 ? retryAfter : floor;
    }

    /** Dispatch backoff: the Retry-After if present, else the supplied default (the tick interval). */
    public static Duration orDefault(@Nullable Duration retryAfter, Duration fallback) {
        return retryAfter != null ? retryAfter : fallback;
    }
}
