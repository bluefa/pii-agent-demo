package com.bff.pipeline.api;

import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskStatus;

import java.util.List;

/** Pipeline progress gauge: DONE task count over total. */
public record Progress(int done, int total) {

    public static Progress of(List<Task> tasks) {
        int done = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        return new Progress(done, tasks.size());
    }
}
