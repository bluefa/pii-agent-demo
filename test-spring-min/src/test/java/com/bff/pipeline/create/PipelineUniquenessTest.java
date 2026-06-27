package com.bff.pipeline.create;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
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
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Per-target uniqueness (minimal-redesign.md §5): one active run per target, a duplicate create returns
 * the existing run, and a target is reusable once its prior run is terminal. The active-target unique violation
 * only surfaces on a REAL committed insert, so this class SUPPRESSES the {@code @DataJpaTest} wrapping
 * transaction ({@link Propagation#NOT_SUPPORTED}) — {@link PipelineInserter} commits independently — and
 * {@link #cleanup()} deletes the committed rows so they cannot leak.
 */
@DataJpaTest
@Import({PipelineCreator.class, PipelineInserter.class, Recipes.class, PipelineUniquenessTest.Wiring.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PipelineUniquenessTest {

    @Autowired private PipelineCreator creator;
    @Autowired private PipelineRepository pipelines;
    @Autowired private TaskRepository tasks;

    @AfterEach
    void cleanup() {
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    @Test
    void duplicateCreateForAnActiveTargetReturnsTheExistingRun() {
        Pipeline first = creator.create("ts-dup", PipelineType.INSTALL);
        Pipeline second = creator.create("ts-dup", PipelineType.INSTALL);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(pipelines.findByStatusOrderByIdAsc(PipelineStatus.RUNNING)).hasSize(1);
    }

    @Test
    void aDifferentTypeCreateForAnActiveTargetReturnsTheExistingRun() {
        // Uniqueness is per TARGET: an active INSTALL makes a same-target DELETE create return the existing
        // INSTALL run, not a raw integrity error and not a second active run.
        Pipeline install = creator.create("ts-mixed", PipelineType.INSTALL);

        Pipeline delete = creator.create("ts-mixed", PipelineType.DELETE);

        assertThat(delete.getId()).isEqualTo(install.getId());
        assertThat(delete.getType()).isEqualTo(PipelineType.INSTALL); // the existing run, unchanged
        assertThat(pipelines.findByStatusOrderByIdAsc(PipelineStatus.RUNNING)).hasSize(1);
    }

    @Test
    void aNewRunIsAllowedForATargetOnceItsPriorRunIsTerminal() {
        Pipeline first = creator.create("ts-reuse", PipelineType.DELETE);
        // Converge the first run to a terminal status so its active_target becomes null.
        first.setStatus(PipelineStatus.DONE);
        pipelines.save(first);

        Pipeline second = creator.create("ts-reuse", PipelineType.DELETE);

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(second.getStatus()).isEqualTo(PipelineStatus.RUNNING);
    }

    @TestConfiguration
    static class Wiring {
        @Bean Clock clock() {
            return Clock.fixed(java.time.Instant.parse("2026-06-23T00:00:00Z"), ZoneOffset.UTC);
        }

        @Bean PipelineSettings pipelineSettings() {
            return PipelineSettings.defaults();
        }
    }
}
