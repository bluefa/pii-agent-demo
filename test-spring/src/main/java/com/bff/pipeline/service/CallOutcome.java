package com.bff.pipeline.service;

/**
 * The result of running one external call through the {@link ExternalCallExecutor}: the handler's value
 * (null when the call exceeded its per-call deadline), the measured latency, and whether it timed out.
 * A {@code timedOut} call is the orchestrator's per-call deadline (CALL_TIMEOUT), distinct from any
 * timeout the handler itself maps from the IM client.
 */
public record CallOutcome<T>(T value, long latencyMs, boolean timedOut) {
}
