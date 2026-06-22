package com.bff.pipeline.repository;

import com.bff.pipeline.entity.Task;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guarded-CAS and scheduling-update behavior of {@link TaskRepository}. As with the pipeline CAS, the
 * {@code @Modifying} queries do not auto-clear, so each test flushes, clears, then re-fetches via
 * {@code findById} before asserting.
 */
@DataJpaTest
class TaskRepositoryCasTest {

    private static final Instant CHECKED_AT = Instant.parse("2026-06-21T10:15:30Z");
    private static final Instant NEXT_CHECK_AT = Instant.parse("2026-06-21T10:20:30Z");

    @Autowired
    private TaskRepository tasks;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void casStatusWithWrongPriorIsNoOp() {
        Task task = persistTask(TaskStatus.READY);

        int updated = tasks.casStatus(task.getId(), TaskStatus.RUNNING, TaskStatus.DONE);
        entityManager.clear();

        assertThat(updated).isZero();
        assertThat(tasks.findById(task.getId()).orElseThrow().getStatus()).isEqualTo(TaskStatus.READY);
    }

    @Test
    void casStatusWithCorrectPriorTransitionsAndBumpsVersion() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        Long version = task.getVersion();

        int updated = tasks.casStatus(task.getId(), TaskStatus.DISPATCHING, TaskStatus.RUNNING);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Task reloaded = tasks.findById(task.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(reloaded.getVersion()).isEqualTo(version + 1);
    }

    @Test
    void casStatusStartingStampsStartedAt() {
        Task task = persistTask(TaskStatus.READY);

        int updated = tasks.casStatusStarting(
                task.getId(), TaskStatus.READY, TaskStatus.DISPATCHING, CHECKED_AT);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Task reloaded = tasks.findById(task.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.DISPATCHING);
        assertThat(reloaded.getStartedAt()).isEqualTo(CHECKED_AT);
    }

    @Test
    void casStatusTerminalStampsFinishedAt() {
        Task task = persistTask(TaskStatus.RUNNING);

        int updated = tasks.casStatusTerminal(
                task.getId(), TaskStatus.RUNNING, TaskStatus.DONE, NEXT_CHECK_AT);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Task reloaded = tasks.findById(task.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(reloaded.getFinishedAt()).isEqualTo(NEXT_CHECK_AT);
    }

    @Test
    void incrementFailCountAddsOne() {
        Task task = persistTask(TaskStatus.RUNNING);
        assertThat(task.getFailCount()).isZero();

        int updated = tasks.incrementFailCount(task.getId());
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        assertThat(tasks.findById(task.getId()).orElseThrow().getFailCount()).isEqualTo(1);
    }

    @Test
    void setScheduleSetsBothLastCheckedAtAndNextCheckAt() {
        Task task = persistTask(TaskStatus.WAITING_EXTERNAL);

        int updated = tasks.setSchedule(task.getId(), CHECKED_AT, NEXT_CHECK_AT);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Task reloaded = tasks.findById(task.getId()).orElseThrow();
        assertThat(reloaded.getLastCheckedAt()).isEqualTo(CHECKED_AT);
        assertThat(reloaded.getNextCheckAt()).isEqualTo(NEXT_CHECK_AT);
    }

    @Test
    void setNextCheckAtSetsOnlyNextCheckAtAndLeavesLastCheckedAt() {
        Task task = persistTask(TaskStatus.WAITING_EXTERNAL);
        tasks.setSchedule(task.getId(), CHECKED_AT, CHECKED_AT);
        entityManager.clear();

        int updated = tasks.setNextCheckAt(task.getId(), NEXT_CHECK_AT);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        Task reloaded = tasks.findById(task.getId()).orElseThrow();
        assertThat(reloaded.getNextCheckAt()).isEqualTo(NEXT_CHECK_AT);
        assertThat(reloaded.getLastCheckedAt()).isEqualTo(CHECKED_AT);
    }

    @Test
    void setDeadlineAtSetsDeadline() {
        Task task = persistTask(TaskStatus.DISPATCHING);

        int updated = tasks.setDeadlineAt(task.getId(), NEXT_CHECK_AT);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        assertThat(tasks.findById(task.getId()).orElseThrow().getDeadlineAt()).isEqualTo(NEXT_CHECK_AT);
    }

    private Task persistTask(TaskStatus status) {
        Task task = new Task();
        task.setPipelineId(1L);
        task.setSeq(0);
        task.setName("apply network");
        task.setHandlerKey("aws.tf.network");
        task.setKind(TaskKind.TERRAFORM_JOB);
        task.setStatus(status);
        task.setMaxFailCount(3);
        task.setFailCount(0);
        Task saved = entityManager.persistAndFlush(task);
        entityManager.clear();
        return saved;
    }
}
