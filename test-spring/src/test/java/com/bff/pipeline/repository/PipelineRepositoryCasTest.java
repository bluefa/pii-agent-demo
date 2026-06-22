package com.bff.pipeline.repository;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guarded-CAS behavior of {@link PipelineRepository}. The CAS queries are {@code @Modifying} without
 * auto-clear, so each test flushes to H2, clears the persistence context, and re-fetches via
 * {@code findById} before asserting — otherwise the stale first-level-cache copy would be read.
 */
@DataJpaTest
class PipelineRepositoryCasTest {

    private static final Instant NOW = Instant.parse("2026-06-21T10:15:30Z");

    @Autowired
    private PipelineRepository pipelines;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void casStatusWithWrongPriorIsNoOpAndLeavesRowUnchanged() {
        Pipeline pipeline = persistRunning();
        Long version = pipeline.getVersion();

        int updated = pipelines.casStatus(pipeline.getId(), PipelineStatus.CANCELLING, PipelineStatus.DONE, NOW);
        entityManager.clear();

        assertThat(updated).isZero();
        Pipeline reloaded = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(reloaded.getLastActivityAt()).isNull();
        assertThat(reloaded.getVersion()).isEqualTo(version);
    }

    @Test
    void casStatusWithCorrectPriorTransitionsAndStampsActivityAndBumpsVersion() {
        Pipeline pipeline = persistRunning();
        Long version = pipeline.getVersion();

        int updated = pipelines.casStatus(pipeline.getId(), PipelineStatus.RUNNING, PipelineStatus.CANCELLING, NOW);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Pipeline reloaded = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PipelineStatus.CANCELLING);
        assertThat(reloaded.getLastActivityAt()).isEqualTo(NOW);
        assertThat(reloaded.getVersion()).isEqualTo(version + 1);
    }

    @Test
    void casStatusWithFailReasonRecordsFailTaskErrorCodeAndFinishedAt() {
        Pipeline pipeline = persistRunning();

        int updated = pipelines.casStatusWithFailReason(
                pipeline.getId(), PipelineStatus.RUNNING, PipelineStatus.FAILED, 42L, ErrorCode.JOB_FAILED, NOW);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Pipeline reloaded = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PipelineStatus.FAILED);
        assertThat(reloaded.getFailReasonTaskId()).isEqualTo(42L);
        assertThat(reloaded.getFailReasonErrorCode()).isEqualTo(ErrorCode.JOB_FAILED);
        assertThat(reloaded.getFinishedAt()).isEqualTo(NOW);
        assertThat(reloaded.getLastActivityAt()).isEqualTo(NOW);
    }

    @Test
    void casTerminalSetsStatusAndFinishedAtAndLeavesFailReasonNull() {
        Pipeline pipeline = persistRunning();

        int updated = pipelines.casTerminal(pipeline.getId(), PipelineStatus.RUNNING, PipelineStatus.DONE, NOW);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Pipeline reloaded = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PipelineStatus.DONE);
        assertThat(reloaded.getFinishedAt()).isEqualTo(NOW);
        assertThat(reloaded.getFailReasonTaskId()).isNull();
        assertThat(reloaded.getFailReasonErrorCode()).isNull();
    }

    @Test
    void touchActivityBumpsLastActivityOnlyAndLeavesStatusUnchanged() {
        Pipeline pipeline = persistRunning();

        int updated = pipelines.touchActivity(pipeline.getId(), NOW);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Pipeline reloaded = pipelines.findById(pipeline.getId()).orElseThrow();
        assertThat(reloaded.getLastActivityAt()).isEqualTo(NOW);
        assertThat(reloaded.getStatus()).isEqualTo(PipelineStatus.RUNNING);
    }

    private Pipeline persistRunning() {
        Pipeline pipeline = new Pipeline();
        pipeline.setTargetSourceId("ts-1");
        pipeline.setType(PipelineType.INSTALL);
        pipeline.setProvider("AWS");
        pipeline.setStatus(PipelineStatus.RUNNING);
        pipeline.setTriggeredBy(Actor.HUMAN);
        pipeline.setCreatedAt(Instant.parse("2026-06-21T10:00:00Z"));
        pipeline.setStartedAt(Instant.parse("2026-06-21T10:00:00Z"));
        Pipeline saved = entityManager.persistAndFlush(pipeline);
        entityManager.clear();
        return saved;
    }
}
