package com.bff.pipeline.api;

import java.util.List;

/** Pipeline drill-down: the summary plus its task chain (api §1 detail). */
public record PipelineDetail(PipelineSummary pipeline, List<TaskView> tasks) {
}
