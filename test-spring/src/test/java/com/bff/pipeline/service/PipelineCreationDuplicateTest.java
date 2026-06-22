package com.bff.pipeline.service;
import com.bff.pipeline.dto.PipelineCreationRequest;
import com.bff.pipeline.dto.PipelineCreationResult;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.repository.PipelineDefSnapshotRepository;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The idempotent-creation contract (§7.2): a duplicate create for a target that already has a non-terminal
 * run returns the existing run ({@code created == false}) instead of erroring.
 *
 * <p>This requires the FIRST run to be committed before the second collides, so the second
 * {@code saveAndFlush} actually violates the non-terminal-unique column and {@link PipelineRunWriter}'s own
 * {@code @Transactional} surfaces a real {@link org.springframework.dao.DataIntegrityViolationException}.
 * The class therefore SUPPRESSES the @DataJpaTest wrapping transaction with
 * {@link Propagation#NOT_SUPPORTED} (the documented exception to "no @Transactional on tests": we are
 * un-masking the writer's commit, not masking it). Because the writes commit for real, {@link #cleanup()}
 * deletes every row so the committed data does not leak into other tests.
 */
@DataJpaTest
@Import({
        PipelineCreationService.class,
        PipelineRunWriter.class,
        PipelineEventRecorder.class,
        com.bff.pipeline.service.handler.PipelineHandlerRegistry.class,
        com.bff.pipeline.service.recipe.RecipeRegistry.class,
        PipelineCreationServiceTest.Wiring.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PipelineCreationDuplicateTest {

    private static final String TARGET = "ts-duplicate-1";

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

    @AfterEach
    void cleanup() {
        events.deleteAll();
        snapshots.deleteAll();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    @Test
    void secondCreateForSameNonTerminalTargetReturnsExistingRunWithoutCreating() {
        PipelineCreationRequest request = PipelineCreationRequest.builder()
                .type(PipelineType.INSTALL).provider("TEST").targetSourceId(TARGET).triggeredBy(Actor.HUMAN).build();

        PipelineCreationResult first = creation.create(request);
        PipelineCreationResult second = creation.create(request);

        assertThat(first.isCreated()).isTrue();
        assertThat(second.isCreated()).isFalse();
        assertThat(second.getPipeline().getId()).isEqualTo(first.getPipeline().getId());
        assertThat(pipelines.findByStatusInOrderByIdAsc(
                java.util.List.of(com.bff.pipeline.type.PipelineStatus.RUNNING))).hasSize(1);
    }
}
