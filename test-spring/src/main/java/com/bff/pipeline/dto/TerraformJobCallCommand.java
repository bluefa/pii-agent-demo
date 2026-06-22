package com.bff.pipeline.dto;

import com.bff.pipeline.service.handler.TerraformJobHandler;
import lombok.Builder;
import lombok.Getter;
import org.springframework.lang.Nullable;

/**
 * Scalars captured for a TERRAFORM_JOB call that runs on the fire-and-forget pool (dispatch or poll).
 * Crosses the async boundary, so it holds only scalars + the stateless handler ref — never a detached
 * JPA entity (§3 / D-T4 discipline). {@code handle} is null for dispatch (no adopted handle yet) and set
 * for poll (the adopted {@code task_attempt.response}).
 */
@Getter
@Builder
public class TerraformJobCallCommand {

    private final long taskId;
    private final long attemptId;
    @Nullable
    private final String handle;
    private final TerraformJobHandler handler;
    private final String targetSourceId;
    private final String name;
}
