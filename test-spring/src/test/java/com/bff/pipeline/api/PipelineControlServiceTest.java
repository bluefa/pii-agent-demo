package com.bff.pipeline.api;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
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
import com.bff.pipeline.service.EventRecorder;
import com.bff.pipeline.service.NewRunWriter;
import com.bff.pipeline.service.PipelineCreationService;
import com.bff.pipeline.repo.PipelineDefSnapshotRepository;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Admin control ({@link PipelineControlService}, api §2): cancel's guarded CAS + idempotency, and retry's
 * "create-or-return-existing" with a RETRY_ATTEMPTED audit event.
 *
 * <p>Like {@link com.bff.pipeline.service.PipelineCreationDuplicateTest}, this SUPPRESSES the {@link DataJpaTest}
 * wrapping transaction with {@link Propagation#NOT_SUPPORTED} so the real tx boundaries run: cancel's own
 * {@code @Transactional}, the writer's commit (needed for the second retry to actually collide on the
 * non-terminal-unique column), and the event inserts all commit for real. Because the writes commit,
 * {@link #cleanup()} deletes every row so committed data does not leak into other tests.
 *
 * <p>The wiring is its OWN copy of {@code PipelineCreationServiceTest.Wiring} (that one is package-private to
 * the service-package test): a fixed {@link Clock}, a vanilla {@link ObjectMapper}, default
 * {@link PipelineSettings}, two named no-Feign fake handlers, and one test recipe.
 */
@DataJpaTest
@Import({
        PipelineControlService.class,
        PipelineCreationService.class,
        NewRunWriter.class,
        EventRecorder.class,
        HandlerRegistry.class,
        RecipeRegistry.class,
        com.bff.pipeline.ops.RuntimeSettings.class,
        PipelineControlServiceTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PipelineControlServiceTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");

    @Autowired
    private PipelineControlService control;
    @Autowired
    private PipelineRepository pipelines;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private PipelineDefSnapshotRepository snapshots;
    @Autowired
    private PipelineEventRepository events;

    @AfterEach
    void cleanup() {
        events.deleteAll();
        snapshots.deleteAll();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    @Test
    void cancelTransitionsRunningToCancellingAndRecordsACancellingEvent() {
        Pipeline running = persistPipeline("ts-cancel-running", PipelineStatus.RUNNING);

        PipelineControlService.CancelResult result = control.cancel(running.getId(), Actor.HUMAN);

        assertThat(result.status()).isEqualTo(PipelineStatus.CANCELLING);
        assertThat(pipelines.findById(running.getId()).orElseThrow().getStatus())
                .isEqualTo(PipelineStatus.CANCELLING);
        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(running.getId()))
                .singleElement()
                .satisfies(event -> assertThat(event.getType()).isEqualTo("PIPELINE:CANCELLING"));
    }

    @Test
    void cancelIsAnIdempotentNoOpOnATerminalPipeline() {
        Pipeline done = persistPipeline("ts-cancel-done", PipelineStatus.DONE);

        PipelineControlService.CancelResult result = control.cancel(done.getId(), Actor.HUMAN);

        assertThat(result.status()).isEqualTo(PipelineStatus.DONE);
        assertThat(pipelines.findById(done.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.DONE);
        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(done.getId())).isEmpty();
    }

    @Test
    void cancelIsAnIdempotentNoOpOnAnAlreadyCancellingPipeline() {
        Pipeline cancelling = persistPipeline("ts-cancel-twice", PipelineStatus.CANCELLING);

        PipelineControlService.CancelResult result = control.cancel(cancelling.getId(), Actor.HUMAN);

        assertThat(result.status()).isEqualTo(PipelineStatus.CANCELLING);
        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(cancelling.getId())).isEmpty(); // no duplicate event
    }

    @Test
    void retryForAFreshTargetCreatesANewRunningPipeline() {
        PipelineControlService.RetryResult result =
                control.retry(PipelineType.INSTALL, "TEST", "ts-retry-fresh", Actor.HUMAN);

        assertThat(result.created()).isTrue();
        Pipeline created = pipelines.findById(result.pipelineId()).orElseThrow();
        assertThat(created.getStatus()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(created.getTargetSourceId()).isEqualTo("ts-retry-fresh");
    }

    @Test
    void retryForATargetWithANonTerminalRunReturnsItAndRecordsRetryAttempted() {
        String target = "ts-retry-existing";
        PipelineControlService.RetryResult first =
                control.retry(PipelineType.INSTALL, "TEST", target, Actor.HUMAN);

        PipelineControlService.RetryResult second =
                control.retry(PipelineType.INSTALL, "TEST", target, Actor.SYSTEM);

        assertThat(second.created()).isFalse();
        assertThat(second.pipelineId()).isEqualTo(first.pipelineId());
        assertThat(events.findByPipelineIdOrderByCreatedAtAsc(second.pipelineId()))
                .extracting(PipelineEvent::getType)
                .contains("PIPELINE:RETRY_ATTEMPTED");
    }

    private Pipeline persistPipeline(String target, PipelineStatus status) {
        Pipeline pipeline = new Pipeline();
        pipeline.setTargetSourceId(target);
        pipeline.setType(PipelineType.INSTALL);
        pipeline.setProvider("TEST");
        pipeline.setStatus(status);
        pipeline.setTriggeredBy(Actor.HUMAN);
        pipeline.setCreatedAt(FIXED);
        pipeline.setStartedAt(FIXED);
        pipeline.setFinishedAt(status.isTerminal() ? FIXED : null);
        pipeline.setLastActivityAt(FIXED);
        return pipelines.save(pipeline);
    }

    /**
     * Test wiring (own copy): fixed {@link Clock}, vanilla {@link ObjectMapper}, default {@link PipelineSettings},
     * two named fake handlers (no Feign — trivial stubs so creation can resolve their keys/kinds), and one test
     * recipe ({@code install/test}, v1, INSTALL, TEST, [terraformJob, conditionCheck]).
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
