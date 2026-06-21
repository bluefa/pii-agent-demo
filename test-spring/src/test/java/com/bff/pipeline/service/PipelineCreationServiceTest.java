package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineDefSnapshot;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.handler.CheckContext;
import com.bff.pipeline.handler.CheckOutcome;
import com.bff.pipeline.handler.ConditionCheckHandler;
import com.bff.pipeline.handler.DispatchContext;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.handler.PollContext;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import com.bff.pipeline.recipe.PipelineDefinition;
import com.bff.pipeline.recipe.RecipeRegistry;
import com.bff.pipeline.recipe.TaskDefinition;
import com.bff.pipeline.repo.PipelineDefSnapshotRepository;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link PipelineCreationService} happy path (Decision 7). Wires the real creation collaborators
 * ({@link NewRunWriter}, {@link EventRecorder}, the two registries) over an H2 schema with a fixed
 * {@link Clock} and two NAMED fake handlers (no Feign). One {@link PipelineDefinition} test recipe drives
 * the chain. The asserts flush + clear the @DataJpaTest persistence context and re-read so the frozen
 * task knobs, snapshot, and creation event are read from H2 rather than the first-level cache.
 */
@DataJpaTest
@Import({
        PipelineCreationService.class,
        NewRunWriter.class,
        EventRecorder.class,
        HandlerRegistry.class,
        RecipeRegistry.class,
        com.bff.pipeline.ops.RuntimeSettings.class,
        PipelineCreationServiceTest.Wiring.class
})
class PipelineCreationServiceTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");
    private static final String TARGET = "ts-create-1";

    @Autowired
    private PipelineCreationService creation;
    @Autowired
    private PipelineRepository pipelines;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private PipelineDefSnapshotRepository snapshots;
    @Autowired
    private PipelineEventRepository events;
    @Autowired
    private TestEntityManager entityManager;
    @Autowired
    private ObjectMapper json;

    @Test
    void createWritesRunningPipelineWithSequencedTasksSnapshotAndCreationEvent() {
        CreationResult result = creation.create(
                new CreationRequest(PipelineType.INSTALL, "TEST", TARGET, Actor.HUMAN));
        entityManager.flush();
        entityManager.clear();

        assertThat(result.created()).isTrue();
        Pipeline pipeline = pipelines.findById(result.pipeline().getId()).orElseThrow();
        assertThat(pipeline.getStatus()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(pipeline.getType()).isEqualTo(PipelineType.INSTALL);
        assertThat(pipeline.getProvider()).isEqualTo("TEST");
        assertThat(pipeline.getTargetSourceId()).isEqualTo(TARGET);
        assertThat(pipeline.getTriggeredBy()).isEqualTo(Actor.HUMAN);
        assertThat(pipeline.getCreatedAt()).isEqualTo(FIXED);
        assertThat(pipeline.getStartedAt()).isEqualTo(FIXED);
        assertThat(pipeline.getLastActivityAt()).isEqualTo(FIXED);

        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId());
        assertThat(chain).hasSize(2);

        Task terraform = chain.get(0);
        assertThat(terraform.getSeq()).isZero();
        assertThat(terraform.getName()).isEqualTo("apply");
        assertThat(terraform.getStatus()).isEqualTo(TaskStatus.BLOCKED); // created BLOCKED; first tick promotes seq0
        assertThat(terraform.getKind()).isEqualTo(TaskKind.TERRAFORM_JOB);
        assertThat(terraform.getHandlerKey()).isEqualTo(FakeTf.KEY);

        Task condition = chain.get(1);
        assertThat(condition.getSeq()).isEqualTo(1);
        assertThat(condition.getName()).isEqualTo("ready");
        assertThat(condition.getStatus()).isEqualTo(TaskStatus.BLOCKED);
        assertThat(condition.getKind()).isEqualTo(TaskKind.CONDITION_CHECK);
        assertThat(condition.getHandlerKey()).isEqualTo(FakeCond.KEY);

        PipelineDefSnapshot snapshot = snapshots.findById(pipeline.getId()).orElseThrow();
        assertThat(snapshot.getDefinitionKey()).isEqualTo("install/test");
        assertThat(snapshot.getDefinitionVersion()).isEqualTo("v1");
        assertThat(snapshot.getType()).isEqualTo(PipelineType.INSTALL);
        assertThat(snapshot.getProvider()).isEqualTo("TEST");

        List<PipelineEvent> created = events.findByPipelineIdOrderByCreatedAtAsc(pipeline.getId());
        assertThat(created).singleElement().satisfies(event -> {
            assertThat(event.getType()).isEqualTo("PIPELINE_CREATED");
            assertThat(event.getSeverity()).isEqualTo(Severity.INFO);
            assertThat(event.getActor()).isEqualTo(Actor.HUMAN);
            assertThat(event.getTaskId()).isNull();
            assertThat(event.getCreatedAt()).isEqualTo(FIXED);
        });
    }

    @Test
    void createFreezesGlobalDefaultKnobsPerTaskKind() {
        Pipeline pipeline = creation.create(
                new CreationRequest(PipelineType.INSTALL, "TEST", TARGET, Actor.SYSTEM)).pipeline();
        entityManager.flush();
        entityManager.clear();

        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId());

        Task terraform = chain.get(0);
        assertThat(terraform.getExecutionTimeout()).isEqualTo(Duration.ofMinutes(30));
        assertThat(terraform.getMaxFailCount()).isEqualTo(3);
        assertThat(terraform.getTtl()).isNull();
        assertThat(terraform.getPollingInterval()).isNull();

        Task condition = chain.get(1);
        assertThat(condition.getTtl()).isEqualTo(Duration.ofHours(168));
        assertThat(condition.getPollingInterval()).isEqualTo(Duration.ofMinutes(10));
        assertThat(condition.getMaxFailCount()).isEqualTo(3);
        assertThat(condition.getExecutionTimeout()).isNull();
    }

    @Test
    void snapshotSpecJsonCapturesResolvedTasksWithFrozenKnobs() throws Exception {
        Pipeline pipeline = creation.create(
                new CreationRequest(PipelineType.INSTALL, "TEST", TARGET, Actor.HUMAN)).pipeline();
        entityManager.flush();
        entityManager.clear();

        PipelineDefSnapshot snapshot = snapshots.findById(pipeline.getId()).orElseThrow();
        JsonNode spec = json.readTree(snapshot.getSpec());

        assertThat(spec.get("name").asText()).isEqualTo("install/test");
        JsonNode specTasks = spec.get("tasks");
        assertThat(specTasks).hasSize(2);

        JsonNode terraform = specTasks.get(0);
        assertThat(terraform.get("seq").asInt()).isZero();
        assertThat(terraform.get("handler_key").asText()).isEqualTo(FakeTf.KEY);
        assertThat(terraform.get("kind").asText()).isEqualTo(TaskKind.TERRAFORM_JOB.name());
        assertThat(terraform.get("execution_timeout").asText()).isEqualTo(Duration.ofMinutes(30).toString());
        assertThat(terraform.get("ttl").isNull()).isTrue();
        assertThat(terraform.get("max_fail_count").asInt()).isEqualTo(3);

        JsonNode condition = specTasks.get(1);
        assertThat(condition.get("seq").asInt()).isEqualTo(1);
        assertThat(condition.get("handler_key").asText()).isEqualTo(FakeCond.KEY);
        assertThat(condition.get("kind").asText()).isEqualTo(TaskKind.CONDITION_CHECK.name());
        assertThat(condition.get("ttl").asText()).isEqualTo(Duration.ofHours(168).toString());
        assertThat(condition.get("polling_interval").asText()).isEqualTo(Duration.ofMinutes(10).toString());
        assertThat(condition.get("execution_timeout").isNull()).isTrue();
    }

    /**
     * Test wiring: a fixed {@link Clock}, a vanilla {@link ObjectMapper} and default {@link PipelineSettings},
     * the two named fake handlers, and the single test recipe. No Feign — the handlers are trivial stubs so
     * creation can resolve their keys/kinds without any IM transport.
     */
    @TestConfiguration
    static class Wiring {

        @Bean
        Clock clock() {
            return Clock.fixed(FIXED, ZoneOffset.UTC);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        PipelineSettings pipelineSettings() {
            return new PipelineSettings();
        }

        @Bean
        TerraformJobHandler fakeTerraformJobHandler() {
            return new FakeTf();
        }

        @Bean
        ConditionCheckHandler fakeConditionCheckHandler() {
            return new FakeCond();
        }

        @Bean
        PipelineDefinition testRecipe() {
            return new PipelineDefinition("install/test", "v1", PipelineType.INSTALL, "TEST", List.of(
                    TaskDefinition.terraformJob("apply", FakeTf.class),
                    TaskDefinition.conditionCheck("ready", FakeCond.class)));
        }
    }

    /** Named TERRAFORM_JOB stub so its key is the frozen handler_key; never dispatched in these tests. */
    static final class FakeTf implements TerraformJobHandler {
        static final String KEY = "test.tf.apply";

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public DispatchOutcome dispatch(DispatchContext ctx) {
            return new DispatchOutcome.Accepted("job-test");
        }

        @Override
        public PollOutcome poll(PollContext ctx) {
            return new PollOutcome.Status(Observed.SUCCEEDED);
        }
    }

    /** Named CONDITION_CHECK stub so its key is the frozen handler_key; never checked in these tests. */
    static final class FakeCond implements ConditionCheckHandler {
        static final String KEY = "test.cond.ready";

        @Override
        public String key() {
            return KEY;
        }

        @Override
        public CheckOutcome check(CheckContext ctx) {
            return new CheckOutcome.Condition(Observed.MET);
        }
    }
}
