package com.bff.pipeline.api;

import com.bff.pipeline.domain.AttemptResult;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.TaskAttempt;

import java.time.Instant;

/** API view of a dispatch attempt; {@code outcome} is derived (api §0), null while the attempt is in-flight. */
public record AttemptView(Long id, Long taskId, int attemptNo, String response, ErrorCode errorCode,
                          Instant startedAt, Instant finishedAt, AttemptOutcome outcome) {

    public static AttemptView of(TaskAttempt a) {
        return new AttemptView(a.getId(), a.getTaskId(), a.getAttemptNo(), a.getResponse(), a.getErrorCode(),
                a.getStartedAt(), a.getFinishedAt(), outcome(a));
    }

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
