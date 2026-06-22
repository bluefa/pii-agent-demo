package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * The result of running one external call through the {@link ExternalCallExecutor}: the handler's value
 * (null when the call exceeded its per-call deadline), the measured latency, and whether it timed out.
 * A {@code timedOut} call is the orchestrator's per-call deadline (CALL_TIMEOUT), distinct from any
 * timeout the handler itself maps from the IM client.
 */
@Getter
@Builder
public class ExternalCallOutcome<T> {

    /** the handler's value; null when the call exceeded its per-call deadline ({@code timedOut}). */
    @Nullable
    private final T value;
    private final long latencyMs;
    private final boolean timedOut;
}
