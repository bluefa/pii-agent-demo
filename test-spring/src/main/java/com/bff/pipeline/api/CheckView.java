package com.bff.pipeline.api;

import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.TaskCheck;

import java.time.Instant;

/** API view of one task_check observation (DISPATCH row / CHECK run). */
public record CheckView(Long id, Long taskId, CheckKind kind, String name, ApiResult apiResult, Observed observed,
                        ErrorCode errorCode, String externalHandle, Instant startedAt, Instant checkedAt,
                        int pollCount, Long latencyMs) {

    public static CheckView of(TaskCheck c) {
        if (c == null) {
            return null;
        }
        return new CheckView(c.getId(), c.getTaskId(), c.getKind(), c.getName(), c.getApiResult(), c.getObserved(),
                c.getErrorCode(), c.getExternalHandle(), c.getStartedAt(), c.getCheckedAt(), c.getPollCount(),
                c.getLatencyMs());
    }
}
