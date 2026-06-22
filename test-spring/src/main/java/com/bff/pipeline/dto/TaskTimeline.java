package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

/** One task's merged action/observation timeline: inline attempts + a page of checks (api §1). */
@Getter
@Builder
public class TaskTimeline {

    private final TaskView task;
    private final List<AttemptView> attempts;
    private final Page<CheckView> checks;
}
