package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.service.handler.TerraformJobHandler;
import lombok.Builder;
import lombok.Getter;

/**
 * The tick's request to fire a TERRAFORM_JOB external call (dispatch or poll). Built and consumed
 * synchronously inside the tick transaction (the launcher extracts scalars before submitting to the
 * fire-and-forget pool), so it may hold the live JPA entities (§3 / D-T4 — entities never cross the
 * async boundary; the scalar {@link TerraformJobCallCommand} does).
 */
@Getter
@Builder
public class TerraformJobCall {

    private final Task task;
    private final TaskAttempt attempt;
    private final TerraformJobHandler handler;
    private final String targetSourceId;
}
