package com.bff.pipeline.api;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.AttemptResult;
import com.bff.pipeline.domain.CheckKind;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskAttempt;
import com.bff.pipeline.domain.TaskCheck;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Read-only Admin queries ({@link PipelineQueryService}, api §1). A plain {@link DataJpaTest}: the wrapping
 * transaction's rollback is acceptable because every behavior here only reads. Seeds entities through the
 * autowired repositories and asserts the derivations (progress, latestCheck, attempt outcome), the filter
 * predicates (status, time-window overlap), the sort fallback, and "latest".
 */
@DataJpaTest
@Import(PipelineQueryService.class)
class PipelineQueryServiceTest {

    private static final Instant T0 = Instant.parse("2026-06-21T10:00:00Z");
    private static final String TARGET = "ts-query-1";

    @Autowired
    private PipelineQueryService query;
    @Autowired
    private PipelineRepository pipelines;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private TaskAttemptRepository attempts;
    @Autowired
    private TaskCheckRepository checks;
    @Autowired
    private PipelineEventRepository events;

    @Test
    void listFiltersByStatus() {
        Pipeline running = persistPipeline("ts-running", PipelineStatus.RUNNING, T0, null);
        persistPipeline("ts-done", PipelineStatus.DONE, T0, T0.plusSeconds(60));

        Page<PipelineSummary> page = query.list(
                new PipelineListFilter(PipelineStatus.RUNNING, null, null, null, null, null), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(summary -> assertThat(summary.id()).isEqualTo(running.getId()));
    }

    @Test
    void listFiltersByTimeWindowOverlapOnStartedFinishedHalfOpenRange() {
        // window [10:30, 11:30). "inside" runs 10:45..11:00 (overlaps); "outside" finished 10:20 (before the window).
        Pipeline inside = persistPipeline("ts-inside", PipelineStatus.DONE,
                T0.plusSeconds(45 * 60), T0.plusSeconds(60 * 60));
        persistPipeline("ts-outside", PipelineStatus.DONE,
                T0.plusSeconds(10 * 60), T0.plusSeconds(20 * 60));

        Instant from = T0.plusSeconds(30 * 60);
        Instant to = T0.plusSeconds(90 * 60);
        Page<PipelineSummary> page = query.list(
                new PipelineListFilter(null, null, null, null, from, to), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(summary -> assertThat(summary.id()).isEqualTo(inside.getId()));
    }

    @Test
    void listFallsBackToDefaultSortForUnsupportedKeyWithoutThrowing() {
        Pipeline older = persistPipeline("ts-sort-a", PipelineStatus.RUNNING, T0, null); // lastActivityAt T0
        Pipeline newer = persistPipeline("ts-sort-b", PipelineStatus.DONE,
                T0.plusSeconds(60), T0.plusSeconds(120)); // lastActivityAt T0+120

        Page<PipelineSummary> page = query.list(
                new PipelineListFilter(null, null, null, null, null, null),
                PageRequest.of(0, 20, Sort.by("provider"))); // unsupported key → fall back, do not throw

        assertThat(page.getContent()).extracting(PipelineSummary::id)
                .containsExactly(newer.getId(), older.getId()); // fallback order = lastActivityAt desc
    }

    @Test
    void listOverlapIncludesAnOngoingRunAndExcludesOneStartingAfterTheWindow() {
        // window [+30m, +60m): an ongoing run started +45m (finishedAt null → overlaps); a run started +90m is after `to`.
        Pipeline ongoing = persistPipeline("ts-ongoing", PipelineStatus.RUNNING, T0.plusSeconds(45 * 60), null);
        persistPipeline("ts-after", PipelineStatus.RUNNING, T0.plusSeconds(90 * 60), null);

        Page<PipelineSummary> page = query.list(
                new PipelineListFilter(null, null, null, null, T0.plusSeconds(30 * 60), T0.plusSeconds(60 * 60)), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(summary -> assertThat(summary.id()).isEqualTo(ongoing.getId()));
    }

    @Test
    void detailProgressCountsDoneTasksOverTotalAndExposesEachTasksLatestCheck() {
        Pipeline pipeline = persistPipeline(TARGET, PipelineStatus.RUNNING, T0, null);
        Task done = persistTask(pipeline.getId(), 0, "apply", TaskKind.TERRAFORM_JOB, TaskStatus.DONE);
        Task running = persistTask(pipeline.getId(), 1, "ready", TaskKind.CONDITION_CHECK, TaskStatus.WAITING_EXTERNAL);

        persistCheck(done.getId(), CheckKind.CHECK, "im.jobStatus", T0.plusSeconds(10));
        TaskCheck latestForDone = persistCheck(done.getId(), CheckKind.CHECK, "im.jobStatus", T0.plusSeconds(30));
        TaskCheck latestForRunning = persistCheck(running.getId(), CheckKind.CHECK, "im.cond", T0.plusSeconds(20));

        PipelineDetail detail = query.detail(pipeline.getId());

        assertThat(detail.progress()).isEqualTo(new Progress(1, 2));
        assertThat(detail.createdAt()).isEqualTo(T0); // flattened detail carries createdAt
        assertThat(detail.tasks()).hasSize(2);
        assertThat(detail.tasks().get(0).latestCheck().id()).isEqualTo(latestForDone.getId());
        assertThat(detail.tasks().get(1).latestCheck().id()).isEqualTo(latestForRunning.getId());
    }

    @Test
    void taskTimelineReturnsAttemptsInlineByAttemptNoAndChecksPaged() {
        Pipeline pipeline = persistPipeline(TARGET, PipelineStatus.RUNNING, T0, null);
        Task task = persistTask(pipeline.getId(), 0, "apply", TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING);
        persistAttempt(task.getId(), 1, T0, T0.plusSeconds(5), AttemptResult.FAIL, ErrorCode.IM_REJECTED);
        persistAttempt(task.getId(), 2, T0.plusSeconds(10), null, null, null);
        persistCheck(task.getId(), CheckKind.DISPATCH, "im.terraformApply", T0);
        persistCheck(task.getId(), CheckKind.CHECK, "im.jobStatus", T0.plusSeconds(15));

        TaskTimeline timeline = query.taskTimeline(pipeline.getId(), task.getId(), PageRequest.of(0, 1));

        assertThat(timeline.attempts()).extracting(AttemptView::attemptNo).containsExactly(1, 2);
        assertThat(timeline.checks().getContent()).hasSize(1);
        assertThat(timeline.checks().getTotalElements()).isEqualTo(2);
    }

    @Test
    void attemptOutcomeIsDerivedForEachResultAndErrorCodeCombination() {
        Pipeline pipeline = persistPipeline(TARGET, PipelineStatus.RUNNING, T0, null);
        Task task = persistTask(pipeline.getId(), 0, "apply", TaskKind.TERRAFORM_JOB, TaskStatus.RUNNING);
        persistAttempt(task.getId(), 1, T0, T0.plusSeconds(1), AttemptResult.OK, null);
        persistAttempt(task.getId(), 2, T0, T0.plusSeconds(2), AttemptResult.FAIL, ErrorCode.EXECUTION_TIMEOUT);
        persistAttempt(task.getId(), 3, T0, T0.plusSeconds(3), AttemptResult.FAIL, ErrorCode.IM_REJECTED);
        persistAttempt(task.getId(), 4, T0, null, null, null);

        TaskTimeline timeline = query.taskTimeline(pipeline.getId(), task.getId(), PageRequest.of(0, 20));

        assertThat(timeline.attempts()).extracting(AttemptView::outcome).containsExactly(
                AttemptOutcome.SUCCEEDED,
                AttemptOutcome.EXECUTION_TIMEOUT,
                AttemptOutcome.FAILED,
                null);
    }

    @Test
    void latestPrefersTheNonTerminalRunOverMoreRecentTerminalRuns() {
        persistPipeline(TARGET, PipelineStatus.DONE, T0.plusSeconds(100), T0.plusSeconds(200));
        Pipeline running = persistPipeline(TARGET, PipelineStatus.RUNNING, T0.plusSeconds(50), null);

        PipelineSummary summary = query.latest(TARGET);

        assertThat(summary.id()).isEqualTo(running.getId());
        assertThat(summary.status()).isEqualTo(PipelineStatus.RUNNING);
    }

    @Test
    void latestFallsBackToTheMostRecentTerminalRunWhenNoneAreActive() {
        persistPipeline(TARGET, PipelineStatus.DONE, T0.plusSeconds(50), T0.plusSeconds(100));
        Pipeline recent = persistPipeline(TARGET, PipelineStatus.FAILED, T0.plusSeconds(300), T0.plusSeconds(400));

        PipelineSummary summary = query.latest(TARGET);

        assertThat(summary.id()).isEqualTo(recent.getId());
    }

    @Test
    void latestIsNullWhenTheTargetHasNoRuns() {
        assertThat(query.latest("ts-never-seen")).isNull();
    }

    @Test
    void eventsFilterBySeverityWhenProvided() {
        Pipeline pipeline = persistPipeline(TARGET, PipelineStatus.RUNNING, T0, null);
        persistEvent(pipeline.getId(), "PIPELINE:CREATED", Severity.INFO, T0);
        PipelineEvent critical = persistEvent(pipeline.getId(), "TASK:FAILED", Severity.CRITICAL, T0.plusSeconds(10));

        Page<PipelineEventView> filtered = query.events(pipeline.getId(), Severity.CRITICAL, unpaged());
        Page<PipelineEventView> all = query.events(pipeline.getId(), null, unpaged());

        assertThat(filtered.getContent()).singleElement()
                .satisfies(view -> assertThat(view.id()).isEqualTo(critical.getId()));
        assertThat(all.getTotalElements()).isEqualTo(2);
    }

    private PageRequest unpaged() {
        return PageRequest.of(0, 50);
    }

    private Pipeline persistPipeline(String target, PipelineStatus status, Instant startedAt, Instant finishedAt) {
        Pipeline pipeline = new Pipeline();
        pipeline.setTargetSourceId(target);
        pipeline.setType(PipelineType.INSTALL);
        pipeline.setProvider("TEST");
        pipeline.setStatus(status);
        pipeline.setTriggeredBy(Actor.HUMAN);
        pipeline.setCreatedAt(startedAt);
        pipeline.setStartedAt(startedAt);
        pipeline.setFinishedAt(finishedAt);
        pipeline.setLastActivityAt(finishedAt == null ? startedAt : finishedAt);
        return pipelines.save(pipeline);
    }

    private Task persistTask(Long pipelineId, int seq, String name, TaskKind kind, TaskStatus status) {
        Task task = new Task();
        task.setPipelineId(pipelineId);
        task.setSeq(seq);
        task.setName(name);
        task.setHandlerKey("test." + name);
        task.setKind(kind);
        task.setStatus(status);
        task.setMaxFailCount(3);
        task.setFailCount(0);
        return tasks.save(task);
    }

    private TaskAttempt persistAttempt(Long taskId, int attemptNo, Instant startedAt, Instant finishedAt,
                                       AttemptResult result, ErrorCode errorCode) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(taskId);
        attempt.setAttemptNo(attemptNo);
        attempt.setStartedAt(startedAt);
        attempt.setFinishedAt(finishedAt);
        attempt.setResult(result);
        attempt.setErrorCode(errorCode);
        return attempts.save(attempt);
    }

    private TaskCheck persistCheck(Long taskId, CheckKind kind, String name, Instant startedAt) {
        TaskCheck check = new TaskCheck();
        check.setTaskId(taskId);
        check.setKind(kind);
        check.setName(name);
        check.setApiResult(ApiResult.OK);
        check.setObserved(kind == CheckKind.CHECK ? Observed.RUNNING : null);
        check.setPollCount(1);
        check.setStartedAt(startedAt);
        check.setCheckedAt(startedAt);
        return checks.save(check);
    }

    private PipelineEvent persistEvent(Long pipelineId, String type, Severity severity, Instant createdAt) {
        PipelineEvent event = new PipelineEvent();
        event.setPipelineId(pipelineId);
        event.setType(type);
        event.setSeverity(severity);
        event.setActor(Actor.SYSTEM);
        event.setCreatedAt(createdAt);
        return events.save(event);
    }
}
