package com.bff.pipeline.dto;

import java.time.Instant;

import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * One CHECK observation (TERRAFORM_JOB poll or CONDITION_CHECK check) to fold into the RLE ledger
 * (Decision 6 / §1.2): the owning task, the optional attempt ({@code null} for CONDITION_CHECK), the
 * operation name, the optional external handle, the classified {@link TaskCheckObservation}, the measured latency,
 * and the backpressure-only {@code next_check_at} ({@code null} unless the IM returned Retry-After).
 */
@Getter
@Builder
public class CheckObservationRecord {

    private final long taskId;
    @Nullable
    private final Long attemptId;
    private final String name;
    @Nullable
    private final String handle;
    private final TaskCheckObservation observation;
    private final long latencyMs;
    @Nullable
    private final Instant backpressureNextCheckAt;
}
