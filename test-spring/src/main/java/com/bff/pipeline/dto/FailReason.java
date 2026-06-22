package com.bff.pipeline.dto;

import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.Pipeline;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/** API view of pipeline.fail_reason (camelCase); null when the pipeline did not fail. */
@Getter
@Builder
public class FailReason {

    @Nullable
    private final Long taskId;
    @Nullable
    private final ErrorCode errorCode;

    @Nullable
    public static FailReason of(Pipeline p) {
        if (p.getFailReasonTaskId() == null && p.getFailReasonErrorCode() == null) {
            return null;
        }
        return FailReason.builder()
                .taskId(p.getFailReasonTaskId())
                .errorCode(p.getFailReasonErrorCode())
                .build();
    }
}
