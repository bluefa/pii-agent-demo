package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.Task;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Pipeline drill-down (api §1 detail) — the run plus its task chain and the computed {@link Progress}.
 * An aggregate read result, not an entity mirror: it bundles the {@link Pipeline}, its {@link Task} chain,
 * and a derived gauge that has no entity home.
 */
@Getter
@Builder
public class PipelineDetail {

    private final Pipeline pipeline;
    private final List<Task> tasks;
    private final Progress progress;
}
