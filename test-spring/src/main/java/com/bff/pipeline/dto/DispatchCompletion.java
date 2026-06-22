package com.bff.pipeline.dto;

import java.time.Instant;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * The call-thread result of a TERRAFORM_JOB dispatch, ready to fill the pre-recorded DISPATCH row
 * (Decision 6 step 4): the pending row id, its task/attempt, the outcome, the measured latency, and the
 * backpressure-only {@code next_check_at} ({@code null} unless the IM returned Retry-After). Scalars + the
 * value outcome only.
 */
@Getter
@Builder
public class DispatchCompletion {

    private final long checkId;
    private final long taskId;
    private final long attemptId;
    private final TerraformDispatchOutcome outcome;
    private final long latencyMs;
    @Nullable
    private final Instant backpressureNextCheckAt;
}
