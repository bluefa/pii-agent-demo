package com.bff.pipeline.service;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.repo.PipelineDefSnapshotRepository;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskRepository;
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
 * {@code saveAndFlush} actually violates the non-terminal-unique column and {@link NewRunWriter}'s own
 * {@code @Transactional} surfaces a real {@link org.springframework.dao.DataIntegrityViolationException}.
 * The class therefore SUPPRESSES the @DataJpaTest wrapping transaction with
 * {@link Propagation#NOT_SUPPORTED} (the documented exception to "no @Transactional on tests": we are
 * un-masking the writer's commit, not masking it). Because the writes commit for real, {@link #cleanup()}
 * deletes every row so the committed data does not leak into other tests.
 */
@DataJpaTest
@Import({
        PipelineCreationService.class,
        NewRunWriter.class,
        EventRecorder.class,
        com.bff.pipeline.handler.HandlerRegistry.class,
        com.bff.pipeline.recipe.RecipeRegistry.class,
        com.bff.pipeline.ops.RuntimeSettings.class,
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
        CreationRequest request = new CreationRequest(PipelineType.INSTALL, "TEST", TARGET, Actor.HUMAN);

        CreationResult first = creation.create(request);
        CreationResult second = creation.create(request);

        assertThat(first.created()).isTrue();
        assertThat(second.created()).isFalse();
        assertThat(second.pipeline().getId()).isEqualTo(first.pipeline().getId());
        assertThat(pipelines.findByStatusInOrderByIdAsc(
                java.util.List.of(com.bff.pipeline.domain.PipelineStatus.RUNNING))).hasSize(1);
    }
}
