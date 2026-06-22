package com.bff.pipeline.dto;

import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.TaskCheck;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.Instant;

/** API view of one task_check observation (DISPATCH row / CHECK run). */
@Getter
@Builder
public class CheckView {

    private final Long id;
    private final Long taskId;
    private final CheckKind kind;
    private final String name;
    private final ApiResult apiResult;
    private final Observed observed;
    private final ErrorCode errorCode;
    private final String externalHandle;
    private final Instant startedAt;
    private final Instant checkedAt;
    private final int pollCount;
    private final Long latencyMs;

    @Nullable
    public static CheckView of(@Nullable TaskCheck c) {
        if (c == null) {
            return null;
        }
        return CheckView.builder()
                .id(c.getId())
                .taskId(c.getTaskId())
                .kind(c.getKind())
                .name(c.getName())
                .apiResult(c.getApiResult())
                .observed(c.getObserved())
                .errorCode(c.getErrorCode())
                .externalHandle(c.getExternalHandle())
                .startedAt(c.getStartedAt())
                .checkedAt(c.getCheckedAt())
                .pollCount(c.getPollCount())
                .latencyMs(c.getLatencyMs())
                .build();
    }
}
