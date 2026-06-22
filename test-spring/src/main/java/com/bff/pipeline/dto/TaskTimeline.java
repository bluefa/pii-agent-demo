package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * One task's merged action/observation timeline: the {@link Task}, its inline {@link TaskAttempt}s, and a
 * page of {@link TaskCheck} observations (api §1). An aggregate read result bundling several entities.
 */
@Getter
@Builder
public class TaskTimeline {

    private final Task task;
    private final List<TaskAttempt> attempts;
    private final Page<TaskCheck> checks;
}
