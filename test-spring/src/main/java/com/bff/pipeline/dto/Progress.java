package com.bff.pipeline.dto;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.type.TaskStatus;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.List;

/** Pipeline progress gauge: DONE task count over total. */
@Getter
@Builder
@EqualsAndHashCode
public class Progress {

    private final int done;
    private final int total;

    public static Progress of(List<Task> tasks) {
        int done = (int) tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        return Progress.builder()
                .done(done)
                .total(tasks.size())
                .build();
    }
}
