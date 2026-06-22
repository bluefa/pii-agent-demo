package com.bff.pipeline.dto;
import com.bff.pipeline.type.AttemptOutcome;

import com.bff.pipeline.type.AttemptResult;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.TaskAttempt;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/** API view of a dispatch attempt; {@code outcome} is derived (api §0), null while the attempt is in-flight. */
@Getter
@Builder
public class AttemptView {

    private final Long id;
    private final Long taskId;
    private final int attemptNo;
    @Nullable
    private final String response;
    @Nullable
    private final ErrorCode errorCode;
    @Nullable
    private final Instant startedAt;
    @Nullable
    private final Instant finishedAt;
    @Nullable
    private final AttemptOutcome outcome;

    public static AttemptView of(TaskAttempt a) {
        return AttemptView.builder()
                .id(a.getId())
                .taskId(a.getTaskId())
                .attemptNo(a.getAttemptNo())
                .response(a.getResponse())
                .errorCode(a.getErrorCode())
                .startedAt(a.getStartedAt())
                .finishedAt(a.getFinishedAt())
                .outcome(outcome(a))
                .build();
    }

    @Nullable
    private static AttemptOutcome outcome(TaskAttempt a) {
        if (a.getFinishedAt() == null) {
            return null; // in-flight: no outcome yet
        }
        if (a.getResult() == AttemptResult.OK) {
            return AttemptOutcome.SUCCEEDED;
        }
        return a.getErrorCode() == ErrorCode.EXECUTION_TIMEOUT ? AttemptOutcome.EXECUTION_TIMEOUT : AttemptOutcome.FAILED;
    }
}
