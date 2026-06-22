package com.bff.pipeline.dto;

import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Duration;

/**
 * Result of a TERRAFORM_JOB job poll. observed in {RUNNING, SUCCEEDED, FAILED}. A poll <em>read</em>
 * failure (CallFailed) does NOT consume fail_count (job not read != job failed) — only an observed
 * FAILED (JOB_FAILED) or execution timeout does.
 */
public sealed interface TerraformPollOutcome {

    @Getter
    @Builder
    final class Status implements TerraformPollOutcome {
        private final Observed observed;
    }

    @Getter
    @Builder
    final class Backpressure implements TerraformPollOutcome {
        @Nullable
        private final Duration retryAfter;
    }

    /** reason in {CHECK_ERROR, CALL_TIMEOUT}. */
    @Getter
    @Builder
    final class CallFailed implements TerraformPollOutcome {
        private final ErrorCode reason;
    }
}
