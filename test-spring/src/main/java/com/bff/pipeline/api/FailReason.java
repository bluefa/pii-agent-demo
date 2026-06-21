package com.bff.pipeline.api;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Pipeline;

/** API view of pipeline.fail_reason (camelCase); null when the pipeline did not fail. */
public record FailReason(Long taskId, ErrorCode errorCode) {

    public static FailReason of(Pipeline p) {
        if (p.getFailReasonTaskId() == null && p.getFailReasonErrorCode() == null) {
            return null;
        }
        return new FailReason(p.getFailReasonTaskId(), p.getFailReasonErrorCode());
    }
}
