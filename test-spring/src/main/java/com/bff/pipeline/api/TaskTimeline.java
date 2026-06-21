package com.bff.pipeline.api;

import org.springframework.data.domain.Page;

import java.util.List;

/** One task's merged action/observation timeline: inline attempts + a page of checks (api §1). */
public record TaskTimeline(TaskView task, List<AttemptView> attempts, Page<CheckView> checks) {
}
