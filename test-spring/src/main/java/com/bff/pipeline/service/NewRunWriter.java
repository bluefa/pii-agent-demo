package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineDefSnapshot;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.recipe.PipelineDefinition;
import com.bff.pipeline.recipe.RecipeRegistry;
import com.bff.pipeline.recipe.TaskDefinition;
import com.bff.pipeline.repo.PipelineDefSnapshotRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class NewRunWriter {

    private final RecipeRegistry recipes;
    private final HandlerRegistry handlers;
    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final PipelineDefSnapshotRepository snapshots;
    private final EventRecorder events;
    private final PipelineSettings settings;
    private final ObjectMapper json;
    private final Clock clock;

    NewRunWriter(RecipeRegistry recipes, HandlerRegistry handlers, PipelineRepository pipelines,
                 TaskRepository tasks, PipelineDefSnapshotRepository snapshots, EventRecorder events,
                 PipelineSettings settings, ObjectMapper json, Clock clock) {
        this.recipes = recipes;
        this.handlers = handlers;
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.snapshots = snapshots;
        this.events = events;
        this.settings = settings;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    Pipeline insertNewRun(CreationRequest req) {
        PipelineDefinition def = recipes.resolve(req.type(), req.provider());
        Instant now = clock.instant();

        Pipeline saved = pipelines.saveAndFlush(newPipeline(req, now)); // non-terminal-unique check fires here

        List<Map<String, Object>> specTasks = new ArrayList<>();
        int seq = 0;
        for (TaskDefinition td : def.tasks()) {
            FrozenKnobs knobs = freeze(td);
            tasks.save(newTask(saved.getId(), seq, td, knobs));
            specTasks.add(specTask(seq, td, knobs));
            seq++;
        }

        snapshots.save(newSnapshot(saved.getId(), def, specTasks));
        events.recordPipelineEvent(saved.getId(), null, "PIPELINE_CREATED", Severity.INFO,
                req.triggeredBy(), writeJson(Map.of("type", def.type().name(), "provider", def.provider())));
        return saved;
    }

    private Pipeline newPipeline(CreationRequest req, Instant now) {
        Pipeline p = new Pipeline();
        p.setTargetSourceId(req.targetSourceId());
        p.setType(req.type());
        p.setProvider(req.provider());
        p.setStatus(PipelineStatus.RUNNING);
        p.setTriggeredBy(req.triggeredBy());
        p.setCreatedAt(now);
        p.setStartedAt(now);
        p.setLastActivityAt(now);
        return p;
    }

    private Task newTask(Long pipelineId, int seq, TaskDefinition td, FrozenKnobs knobs) {
        Task t = new Task();
        t.setPipelineId(pipelineId);
        t.setSeq(seq);
        t.setName(td.name());
        t.setHandlerKey(handlers.keyOf(td.handlerClass()));
        t.setKind(td.kind());
        t.setStatus(seq == 0 ? TaskStatus.READY : TaskStatus.BLOCKED); // first task eligible, rest gated on predecessor
        t.setTtl(knobs.ttl());
        t.setPollingInterval(knobs.pollingInterval());
        t.setExecutionTimeout(knobs.executionTimeout());
        t.setMaxFailCount(knobs.maxFailCount());
        t.setFailCount(0);
        return t;
    }

    private PipelineDefSnapshot newSnapshot(Long pipelineId, PipelineDefinition def, List<Map<String, Object>> specTasks) {
        PipelineDefSnapshot s = new PipelineDefSnapshot();
        s.setPipelineId(pipelineId);
        s.setDefinitionKey(def.definitionKey());
        s.setDefinitionVersion(def.version());
        s.setType(def.type());
        s.setProvider(def.provider());
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("definitionKey", def.definitionKey());
        spec.put("version", def.version());
        spec.put("tasks", specTasks);
        s.setSpec(writeJson(spec));
        return s;
    }

    /** Frozen knobs: each null recipe knob resolves to the global default (api.md §4), kind-aware. */
    private FrozenKnobs freeze(TaskDefinition td) {
        int maxFail = td.maxFailCount() != null ? td.maxFailCount() : settings.getMaxFailCount();
        if (td.kind() == TaskKind.TERRAFORM_JOB) {
            Duration exec = td.executionTimeout() != null ? td.executionTimeout() : settings.getExecutionTimeout();
            return new FrozenKnobs(null, null, exec, maxFail);
        }
        Duration ttl = td.ttl() != null ? td.ttl() : settings.getWaitExternalTtl();
        Duration poll = td.pollingInterval() != null ? td.pollingInterval() : settings.getConditionPollingGuard();
        return new FrozenKnobs(ttl, poll, null, maxFail);
    }

    private Map<String, Object> specTask(int seq, TaskDefinition td, FrozenKnobs knobs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("seq", seq);
        m.put("name", td.name());
        m.put("handlerKey", handlers.keyOf(td.handlerClass()));
        m.put("kind", td.kind().name());
        m.put("ttl", asText(knobs.ttl()));
        m.put("pollingInterval", asText(knobs.pollingInterval()));
        m.put("executionTimeout", asText(knobs.executionTimeout()));
        m.put("maxFailCount", knobs.maxFailCount());
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

    private record FrozenKnobs(Duration ttl, Duration pollingInterval, Duration executionTimeout, int maxFailCount) {
    }
}
