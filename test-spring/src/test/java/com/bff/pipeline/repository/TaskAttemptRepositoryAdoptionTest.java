package com.bff.pipeline.repository;

import com.bff.pipeline.type.AttemptResult;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The response-adoption guard ({@code adoptResponseWhileDispatching}) and the attempt-close CAS of
 * {@link TaskAttemptRepository}. The adoption query has a cross-row predicate: the attempt must be open
 * (response null, finishedAt null) AND its task must still be {@code DISPATCHING}. A response that arrives
 * after the task has left DISPATCHING matches 0 rows and is dropped — this is the late-response block.
 *
 * <p>The {@code @Modifying} queries do not auto-clear, so each test flushes, clears, then re-fetches via
 * {@code findById} before asserting.
 */
@DataJpaTest
class TaskAttemptRepositoryAdoptionTest {

    private static final String HANDLE = "{\"job_id\":\"job-1\"}";
    private static final Instant NOW = Instant.parse("2026-06-21T10:15:30Z");

    @Autowired
    private TaskAttemptRepository attempts;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void adoptsResponseWhenAttemptOpenAndTaskDispatching() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        TaskAttempt attempt = persistOpenAttempt(task.getId());

        int updated = attempts.adoptResponseWhileDispatching(attempt.getId(), HANDLE);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isEqualTo(HANDLE);
    }

    @Test
    void doesNotAdoptResponseWhenTaskNoLongerDispatching() {
        Task task = persistTask(TaskStatus.RUNNING);
        TaskAttempt attempt = persistOpenAttempt(task.getId());

        int updated = attempts.adoptResponseWhileDispatching(attempt.getId(), HANDLE);
        entityManager.clear();

        assertThat(updated).isZero();
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void doesNotAdoptResponseWhenTaskAlreadyTerminal() {
        Task task = persistTask(TaskStatus.FAILED);
        TaskAttempt attempt = persistOpenAttempt(task.getId());

        int updated = attempts.adoptResponseWhileDispatching(attempt.getId(), HANDLE);
        entityManager.clear();

        assertThat(updated).isZero();
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void doesNotAdoptResponseWhenResponseAlreadySet() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        TaskAttempt attempt = persistAttempt(task.getId(), "{\"job_id\":\"prior\"}", null);

        int updated = attempts.adoptResponseWhileDispatching(attempt.getId(), HANDLE);
        entityManager.clear();

        assertThat(updated).isZero();
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse())
                .isEqualTo("{\"job_id\":\"prior\"}");
    }

    @Test
    void doesNotAdoptResponseWhenAttemptAlreadyFinished() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        TaskAttempt attempt = persistAttempt(task.getId(), null, NOW);

        int updated = attempts.adoptResponseWhileDispatching(attempt.getId(), HANDLE);
        entityManager.clear();

        assertThat(updated).isZero();
        assertThat(attempts.findById(attempt.getId()).orElseThrow().getResponse()).isNull();
    }

    @Test
    void closeFailedSetsFailResultErrorCodeAndFinishedAtThenIsIdempotent() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        TaskAttempt attempt = persistOpenAttempt(task.getId());

        int firstClose = attempts.closeFailed(attempt.getId(), ErrorCode.IM_REJECTED, NOW);
        entityManager.clear();

        assertThat(firstClose).isEqualTo(1);
        TaskAttempt afterFirst = attempts.findById(attempt.getId()).orElseThrow();
        assertThat(afterFirst.getResult()).isEqualTo(AttemptResult.FAIL);
        assertThat(afterFirst.getErrorCode()).isEqualTo(ErrorCode.IM_REJECTED);
        assertThat(afterFirst.getFinishedAt()).isEqualTo(NOW);

        Instant secondNow = NOW.plusSeconds(60);
        int secondClose = attempts.closeFailed(attempt.getId(), ErrorCode.JOB_FAILED, secondNow);
        entityManager.clear();

        assertThat(secondClose).isZero();
        TaskAttempt afterSecond = attempts.findById(attempt.getId()).orElseThrow();
        assertThat(afterSecond.getErrorCode()).isEqualTo(ErrorCode.IM_REJECTED);
        assertThat(afterSecond.getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void closeOkSetsOkResultAndFinishedAtAndLeavesErrorCodeNull() {
        Task task = persistTask(TaskStatus.DISPATCHING);
        TaskAttempt attempt = persistOpenAttempt(task.getId());

        int updated = attempts.closeOk(attempt.getId(), NOW);
        entityManager.clear();

        assertThat(updated).isEqualTo(1);
        TaskAttempt reloaded = attempts.findById(attempt.getId()).orElseThrow();
        assertThat(reloaded.getResult()).isEqualTo(AttemptResult.OK);
        assertThat(reloaded.getFinishedAt()).isEqualTo(NOW);
        assertThat(reloaded.getErrorCode()).isNull();
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

    private TaskAttempt persistOpenAttempt(Long taskId) {
        return persistAttempt(taskId, null, null);
    }

    /** persist a single attempt with the given pre-state (open = null response + null finishedAt). */
    private TaskAttempt persistAttempt(Long taskId, String response, Instant finishedAt) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(taskId);
        attempt.setAttemptNo(1);
        attempt.setStartedAt(Instant.parse("2026-06-21T10:10:00Z"));
        attempt.setResponse(response);
        attempt.setFinishedAt(finishedAt);
        TaskAttempt saved = entityManager.persistAndFlush(attempt);
        entityManager.clear();
        return saved;
    }
}
