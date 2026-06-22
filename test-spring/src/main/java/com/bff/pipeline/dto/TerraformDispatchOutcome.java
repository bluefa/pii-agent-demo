package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * Result of a TERRAFORM_JOB dispatch call. Backpressure (429/503) is NOT a failure: fail_count is not
 * consumed and the same logical attempt is reused. CallTimeout/Rejected attribute to the attempt.
 */
public sealed interface TerraformDispatchOutcome {

    /** dispatch accepted; handle (job_id) returned. Adopted into attempt.response (write-once). */
    @Getter
    @Builder
    final class Accepted implements TerraformDispatchOutcome {
        private final String handle;
    }

    /** IM hard-rejected (non-backpressure) -> IM_REJECTED, attempt fail. */
    @Getter
    @Builder
    final class Rejected implements TerraformDispatchOutcome {
        private final String detail;
    }

    /** 429/503 -> not a failure; retryAfter may be null (then next tick). */
    @Getter
    @Builder
    final class Backpressure implements TerraformDispatchOutcome {
        @Nullable
        private final Duration retryAfter;
    }

    /** the single call timed out -> CALL_TIMEOUT; DISPATCHING held, recovery decides the attempt's fate. */
    final class CallTimeout implements TerraformDispatchOutcome {}
}
