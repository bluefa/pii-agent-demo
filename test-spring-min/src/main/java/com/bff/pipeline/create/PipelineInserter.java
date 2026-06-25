package com.bff.pipeline.create;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * The transactional insert of one new run (split out from {@link PipelineCreator} so its {@code @Transactional}
 * boundary is a real proxied commit). The pipeline is saved first ({@code saveAndFlush}) so the per-target
 * unique violation fires HERE — letting the caller catch it and return the existing run without the
 * failure poisoning the caller's work.
 */
@Component
public class PipelineInserter {

    private final Recipes recipes;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final Clock clock;

    public PipelineInserter(Recipes recipes, PipelineRepository pipelines, TaskRepository tasks, Clock clock) {
        this.recipes = recipes;
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.clock = clock;
    }

    @Transactional
    public Pipeline insert(String target, PipelineType type) {
        Instant now = clock.instant();
        Pipeline pipeline = pipelines.saveAndFlush(Pipeline.builder() // flush so the unique violation fires now
                .type(type).target(target).status(PipelineStatus.RUNNING)
                .createdAt(now).lastActivityAt(now).build());

        List<Recipe.Step> steps = recipes.forType(type).steps();
        for (int seq = 0; seq < steps.size(); seq++) {
            Recipe.Step step = steps.get(seq);
            tasks.save(Task.builder()
                    .pipelineId(pipeline.getId()).seq(seq).kind(step.kind()).operation(step.operation())
                    .status(TaskStatus.READY).readyAt(now).failCount(0).build());
        }
        return pipeline;
    }
}
