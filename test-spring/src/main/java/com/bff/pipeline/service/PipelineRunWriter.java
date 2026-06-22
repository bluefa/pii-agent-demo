package com.bff.pipeline.service;
import com.bff.pipeline.dto.PipelineCreationRequest;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.PipelineDefSnapshot;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.PipelineEventType;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.dto.PipelineDefinition;
import com.bff.pipeline.service.recipe.RecipeRegistry;
import com.bff.pipeline.dto.TaskDefinition;
import com.bff.pipeline.repository.PipelineDefSnapshotRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The transactional write of one new pipeline run (Decision 7 creation contract). Kept separate from
 * {@link PipelineCreationService} so its {@code @Transactional} boundary is a real proxied commit: the
 * non-terminal-unique violation surfaces when this method's transaction fails, letting the caller catch
 * it and return the existing run. The pipeline is saved first (saveAndFlush) so the violation fires
 * immediately rather than at an ambiguous later commit.
 */
@Component
public class PipelineRunWriter {

    private final RecipeRegistry recipes;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final PipelineDefSnapshotRepository snapshots;
    private final PipelineEventRecorder events;
    private final PipelineEngineSettings settings;
    private final ObjectMapper json;
    private final Clock clock;

    PipelineRunWriter(RecipeRegistry recipes, PipelineRepository pipelines,
                 TaskRepository tasks, PipelineDefSnapshotRepository snapshots, PipelineEventRecorder events,
                 PipelineEngineSettings settings, ObjectMapper json, Clock clock) {
        this.recipes = recipes;
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.snapshots = snapshots;
        this.events = events;
        this.settings = settings;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    Pipeline insertNewRun(PipelineCreationRequest req) {
        PipelineDefinition def = recipes.resolve(req.getType(), req.getProvider());
        Instant now = clock.instant();

        Pipeline saved = pipelines.saveAndFlush(newPipeline(req, now)); // non-terminal-unique check fires here

        List<Map<String, Object>> specTasks = new ArrayList<>();
        int seq = 0;
        for (TaskDefinition td : def.getTasks()) {
            FrozenTask spec = FrozenTask.builder().seq(seq).definition(td).knobs(freeze(td)).build();
            tasks.save(newTask(saved.getId(), spec));
            specTasks.add(specTask(spec));
            seq++;
        }

        snapshots.save(newSnapshot(saved.getId(), def, specTasks));
        events.recordPipelineEvent(PipelineEvent.builder()
                .pipelineId(saved.getId())
                .type(PipelineEventType.PIPELINE_CREATED.wire())
                .severity(Severity.INFO)
                .actor(req.getTriggeredBy())
                .payload(writeJson(Map.of("type", def.getType().name(), "provider", def.getProvider())))
                .build());
        return saved;
    }

    private Pipeline newPipeline(PipelineCreationRequest req, Instant now) {
        Pipeline p = new Pipeline();
        p.setTargetSourceId(req.getTargetSourceId());
        p.setType(req.getType());
        p.setProvider(req.getProvider());
        p.setStatus(PipelineStatus.RUNNING);
        p.setTriggeredBy(req.getTriggeredBy());
        p.setCreatedAt(now);
        p.setStartedAt(now);
        p.setLastActivityAt(now);
        return p;
    }

    private Task newTask(Long pipelineId, FrozenTask spec) {
        TaskDefinition td = spec.getDefinition();
        FrozenKnobs knobs = spec.getKnobs();
        Task t = new Task();
        t.setPipelineId(pipelineId);
        t.setSeq(spec.getSeq());
        t.setName(td.getName());
        t.setOperation(td.getOperation());
        t.setKind(td.getKind());
        t.setStatus(TaskStatus.BLOCKED); // all tasks start BLOCKED; the first tick promotes seq0 → READY (state-machine)
        t.setTtl(knobs.getTtl());
        t.setPollingInterval(knobs.getPollingInterval());
        t.setExecutionTimeout(knobs.getExecutionTimeout());
        t.setMaxFailCount(knobs.getMaxFailCount());
        t.setFailCount(0);
        return t;
    }

    private PipelineDefSnapshot newSnapshot(Long pipelineId, PipelineDefinition def, List<Map<String, Object>> specTasks) {
        PipelineDefSnapshot s = new PipelineDefSnapshot();
        s.setPipelineId(pipelineId);
        s.setDefinitionKey(def.getDefinitionKey());
        s.setDefinitionVersion(def.getVersion());
        s.setType(def.getType());
        s.setProvider(def.getProvider());
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("name", def.getDefinitionKey());
        spec.put("tasks", specTasks);
        s.setSpec(writeJson(spec));
        return s;
    }

    /** Frozen knobs: each null recipe knob resolves to the global default (api.md §4), kind-aware. */
    private FrozenKnobs freeze(TaskDefinition td) {
        int maxFail = td.getMaxFailCount() != null ? td.getMaxFailCount() : settings.getMaxFailCount();
        if (td.getKind() == TaskKind.TERRAFORM_JOB) {
            Duration exec = td.getExecutionTimeout() != null ? td.getExecutionTimeout() : settings.getExecutionTimeout();
            return FrozenKnobs.builder().executionTimeout(exec).maxFailCount(maxFail).build();
        }
        Duration ttl = td.getTtl() != null ? td.getTtl() : settings.getWaitExternalTtl();
        Duration poll = td.getPollingInterval() != null ? td.getPollingInterval() : settings.getConditionPollingGuard();
        return FrozenKnobs.builder().ttl(ttl).pollingInterval(poll).maxFailCount(maxFail).build();
    }

    private Map<String, Object> specTask(FrozenTask spec) {
        TaskDefinition td = spec.getDefinition();
        FrozenKnobs knobs = spec.getKnobs();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("seq", spec.getSeq());
        m.put("name", td.getName());
        m.put("operation", td.getOperation()); // internal jsonb = snake_case (orchestrator §1.2)
        m.put("kind", td.getKind().name());
        m.put("ttl", asText(knobs.getTtl()));
        m.put("polling_interval", asText(knobs.getPollingInterval()));
        m.put("execution_timeout", asText(knobs.getExecutionTimeout()));
        m.put("max_fail_count", knobs.getMaxFailCount());
        return m;
    }

    private static String asText(Duration d) {
        return d == null ? null : d.toString();
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("failed to serialize pipeline spec", e);
        }
    }

    @Getter
    @Builder
    private static class FrozenKnobs {
        private final Duration ttl;
        private final Duration pollingInterval;
        private final Duration executionTimeout;
        private final int maxFailCount;
    }

    /** One task's frozen creation spec: its position, its recipe definition, and the resolved knobs. */
    @Getter
    @Builder
    private static class FrozenTask {
        private final int seq;
        private final TaskDefinition definition;
        private final FrozenKnobs knobs;
    }
}
