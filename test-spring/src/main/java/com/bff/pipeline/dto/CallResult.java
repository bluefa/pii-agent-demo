package com.bff.pipeline.dto;

import com.bff.pipeline.type.CallStatus;
import com.bff.pipeline.type.ErrorCode;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * The single result of one external IM call (dispatch AND poll AND check) — the collapsed replacement for the
 * three former sealed outcome hierarchies. The {@link CallStatus} 4-way distinction is the load-bearing part
 * (SUCCESS / BACKPRESSURE / REJECT / TIMEOUT — see {@link CallStatus}); the other fields carry the payload:
 * <ul>
 *   <li>{@code value} — the SUCCESS payload: the dispatch job_id, or the poll/check observed value.</li>
 *   <li>{@code errorCode} — the REJECT/TIMEOUT bucket code (IM_REJECTED / CHECK_ERROR / CALL_TIMEOUT).</li>
 *   <li>{@code retryAfter} — the BACKPRESSURE Retry-After (may be null → next tick / kind cadence).</li>
 *   <li>{@code latencyMs} — the measured call duration the observation row records.</li>
 * </ul>
 */
@Getter
@Builder
public class CallResult {

    private final CallStatus status;
    @Nullable
    private final String value;
    @Nullable
    private final ErrorCode errorCode;
    @Nullable
    private final Duration retryAfter;
    private final long latencyMs;
}
