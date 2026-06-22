package com.bff.pipeline.service;
import com.bff.pipeline.type.AttemptOutcome;
import com.bff.pipeline.dto.PipelineDetail;
import com.bff.pipeline.dto.PipelineListFilter;
import com.bff.pipeline.dto.Progress;
import com.bff.pipeline.dto.TaskTimeline;

import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.AttemptResult;
import com.bff.pipeline.type.CheckKind;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.type.TaskStatus;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
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
        Pipeline running = persistPipeline(PipelineSeed.builder().target("ts-running").status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build());
        persistPipeline(PipelineSeed.builder().target("ts-done").status(PipelineStatus.DONE).startedAt(T0).finishedAt(T0.plusSeconds(60)).build());

        Page<Pipeline> page = query.list(
                PipelineListFilter.builder().status(PipelineStatus.RUNNING).build(), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(pipeline -> assertThat(pipeline.getId()).isEqualTo(running.getId()));
    }

    @Test
    void listFiltersByTimeWindowOverlapOnStartedFinishedHalfOpenRange() {
        // window [10:30, 11:30). "inside" runs 10:45..11:00 (overlaps); "outside" finished 10:20 (before the window).
        Pipeline inside = persistPipeline(PipelineSeed.builder().target("ts-inside").status(PipelineStatus.DONE)
                .startedAt(T0.plusSeconds(45 * 60)).finishedAt(T0.plusSeconds(60 * 60)).build());
        persistPipeline(PipelineSeed.builder().target("ts-outside").status(PipelineStatus.DONE)
                .startedAt(T0.plusSeconds(10 * 60)).finishedAt(T0.plusSeconds(20 * 60)).build());

        Instant from = T0.plusSeconds(30 * 60);
        Instant to = T0.plusSeconds(90 * 60);
        Page<Pipeline> page = query.list(
                PipelineListFilter.builder().from(from).to(to).build(), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(pipeline -> assertThat(pipeline.getId()).isEqualTo(inside.getId()));
    }

    @Test
    void listFallsBackToDefaultSortForUnsupportedKeyWithoutThrowing() {
        Pipeline older = persistPipeline(PipelineSeed.builder().target("ts-sort-a").status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build()); // lastActivityAt T0
        Pipeline newer = persistPipeline(PipelineSeed.builder().target("ts-sort-b").status(PipelineStatus.DONE)
                .startedAt(T0.plusSeconds(60)).finishedAt(T0.plusSeconds(120)).build()); // lastActivityAt T0+120

        Page<Pipeline> page = query.list(
                PipelineListFilter.builder().build(),
                PageRequest.of(0, 20, Sort.by("provider"))); // unsupported key → fall back, do not throw

        assertThat(page.getContent()).extracting(Pipeline::getId)
                .containsExactly(newer.getId(), older.getId()); // fallback order = lastActivityAt desc
    }

    @Test
    void listOverlapIncludesAnOngoingRunAndExcludesOneStartingAfterTheWindow() {
        // window [+30m, +60m): an ongoing run started +45m (finishedAt null → overlaps); a run started +90m is after `to`.
        Pipeline ongoing = persistPipeline(PipelineSeed.builder().target("ts-ongoing").status(PipelineStatus.RUNNING).startedAt(T0.plusSeconds(45 * 60)).finishedAt(null).build());
        persistPipeline(PipelineSeed.builder().target("ts-after").status(PipelineStatus.RUNNING).startedAt(T0.plusSeconds(90 * 60)).finishedAt(null).build());

        Page<Pipeline> page = query.list(
                PipelineListFilter.builder().from(T0.plusSeconds(30 * 60)).to(T0.plusSeconds(60 * 60)).build(), unpaged());

        assertThat(page.getContent()).singleElement()
                .satisfies(pipeline -> assertThat(pipeline.getId()).isEqualTo(ongoing.getId()));
    }

    @Test
    void detailProgressCountsDoneTasksOverTotalAndExposesEachTasksLatestCheck() {
        Pipeline pipeline = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build());
        Task done = persistTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).name("apply").kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.DONE).build());
        Task running = persistTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(1).name("ready").kind(TaskKind.CONDITION_CHECK).status(TaskStatus.WAITING_EXTERNAL).build());

        persistCheck(CheckSeed.builder().taskId(done.getId()).kind(CheckKind.CHECK).name("im.jobStatus").startedAt(T0.plusSeconds(10)).build());
        TaskCheck latestForDone = persistCheck(CheckSeed.builder().taskId(done.getId()).kind(CheckKind.CHECK).name("im.jobStatus").startedAt(T0.plusSeconds(30)).build());
        TaskCheck latestForRunning = persistCheck(CheckSeed.builder().taskId(running.getId()).kind(CheckKind.CHECK).name("im.cond").startedAt(T0.plusSeconds(20)).build());

        PipelineDetail detail = query.detail(pipeline.getId());

        assertThat(detail.getProgress()).isEqualTo(Progress.builder().done(1).total(2).build());
        assertThat(detail.getPipeline().getCreatedAt()).isEqualTo(T0); // detail carries the run entity
        assertThat(detail.getTasks()).hasSize(2);
        assertThat(query.latestCheck(detail.getTasks().get(0).getId()).getId()).isEqualTo(latestForDone.getId());
        assertThat(query.latestCheck(detail.getTasks().get(1).getId()).getId()).isEqualTo(latestForRunning.getId());
    }

    @Test
    void taskTimelineReturnsAttemptsInlineByAttemptNoAndChecksPaged() {
        Pipeline pipeline = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build());
        Task task = persistTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).name("apply").kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(T0).finishedAt(T0.plusSeconds(5)).result(AttemptResult.FAIL).errorCode(ErrorCode.IM_REJECTED).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(2).startedAt(T0.plusSeconds(10)).finishedAt(null).result(null).errorCode(null).build());
        persistCheck(CheckSeed.builder().taskId(task.getId()).kind(CheckKind.DISPATCH).name("im.terraformApply").startedAt(T0).build());
        persistCheck(CheckSeed.builder().taskId(task.getId()).kind(CheckKind.CHECK).name("im.jobStatus").startedAt(T0.plusSeconds(15)).build());

        TaskTimeline timeline = query.taskTimeline(pipeline.getId(), task.getId(), PageRequest.of(0, 1));

        assertThat(timeline.getAttempts()).extracting(TaskAttempt::getAttemptNo).containsExactly(1, 2);
        assertThat(timeline.getChecks().getContent()).hasSize(1);
        assertThat(timeline.getChecks().getTotalElements()).isEqualTo(2);
    }

    @Test
    void attemptOutcomeIsDerivedForEachResultAndErrorCodeCombination() {
        Pipeline pipeline = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build());
        Task task = persistTask(TaskSeed.builder().pipelineId(pipeline.getId()).seq(0).name("apply").kind(TaskKind.TERRAFORM_JOB).status(TaskStatus.RUNNING).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(1).startedAt(T0).finishedAt(T0.plusSeconds(1)).result(AttemptResult.OK).errorCode(null).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(2).startedAt(T0).finishedAt(T0.plusSeconds(2)).result(AttemptResult.FAIL).errorCode(ErrorCode.EXECUTION_TIMEOUT).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(3).startedAt(T0).finishedAt(T0.plusSeconds(3)).result(AttemptResult.FAIL).errorCode(ErrorCode.IM_REJECTED).build());
        persistAttempt(AttemptSeed.builder().taskId(task.getId()).attemptNo(4).startedAt(T0).finishedAt(null).result(null).errorCode(null).build());

        TaskTimeline timeline = query.taskTimeline(pipeline.getId(), task.getId(), PageRequest.of(0, 20));

        assertThat(timeline.getAttempts()).extracting(PipelineQueryService::outcomeOf).containsExactly(
                AttemptOutcome.SUCCEEDED,
                AttemptOutcome.EXECUTION_TIMEOUT,
                AttemptOutcome.FAILED,
                null);
    }

    @Test
    void latestPrefersTheNonTerminalRunOverMoreRecentTerminalRuns() {
        persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.DONE).startedAt(T0.plusSeconds(100)).finishedAt(T0.plusSeconds(200)).build());
        Pipeline running = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.RUNNING).startedAt(T0.plusSeconds(50)).finishedAt(null).build());

        Pipeline summary = query.latest(TARGET);

        assertThat(summary.getId()).isEqualTo(running.getId());
        assertThat(summary.getStatus()).isEqualTo(PipelineStatus.RUNNING);
    }

    @Test
    void latestFallsBackToTheMostRecentTerminalRunWhenNoneAreActive() {
        persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.DONE).startedAt(T0.plusSeconds(50)).finishedAt(T0.plusSeconds(100)).build());
        Pipeline recent = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.FAILED).startedAt(T0.plusSeconds(300)).finishedAt(T0.plusSeconds(400)).build());

        Pipeline summary = query.latest(TARGET);

        assertThat(summary.getId()).isEqualTo(recent.getId());
    }

    @Test
    void latestIsNullWhenTheTargetHasNoRuns() {
        assertThat(query.latest("ts-never-seen")).isNull();
    }

    @Test
    void eventsFilterBySeverityWhenProvided() {
        Pipeline pipeline = persistPipeline(PipelineSeed.builder().target(TARGET).status(PipelineStatus.RUNNING).startedAt(T0).finishedAt(null).build());
        persistEvent(EventSeed.builder().pipelineId(pipeline.getId()).type("PIPELINE:CREATED").severity(Severity.INFO).createdAt(T0).build());
        PipelineEvent critical = persistEvent(EventSeed.builder().pipelineId(pipeline.getId()).type("TASK:FAILED").severity(Severity.CRITICAL).createdAt(T0.plusSeconds(10)).build());

        Page<PipelineEvent> filtered = query.events(pipeline.getId(), Severity.CRITICAL, unpaged());
        Page<PipelineEvent> all = query.events(pipeline.getId(), null, unpaged());

        assertThat(filtered.getContent()).singleElement()
                .satisfies(event -> assertThat(event.getId()).isEqualTo(critical.getId()));
        assertThat(all.getTotalElements()).isEqualTo(2);
    }

    private PageRequest unpaged() {
        return PageRequest.of(0, 50);
    }

    private Pipeline persistPipeline(PipelineSeed seed) {
        Pipeline pipeline = new Pipeline();
        pipeline.setTargetSourceId(seed.target);
        pipeline.setType(PipelineType.INSTALL);
        pipeline.setProvider("TEST");
        pipeline.setStatus(seed.status);
        pipeline.setTriggeredBy(Actor.HUMAN);
        pipeline.setCreatedAt(seed.startedAt);
        pipeline.setStartedAt(seed.startedAt);
        pipeline.setFinishedAt(seed.finishedAt);
        pipeline.setLastActivityAt(seed.finishedAt == null ? seed.startedAt : seed.finishedAt);
        return pipelines.save(pipeline);
    }

    private Task persistTask(TaskSeed seed) {
        Task task = new Task();
        task.setPipelineId(seed.pipelineId);
        task.setSeq(seed.seq);
        task.setName(seed.name);
        task.setOperation("op-" + seed.name);
        task.setKind(seed.kind);
        task.setStatus(seed.status);
        task.setMaxFailCount(3);
        task.setFailCount(0);
        return tasks.save(task);
    }

    private TaskAttempt persistAttempt(AttemptSeed seed) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(seed.taskId);
        attempt.setAttemptNo(seed.attemptNo);
        attempt.setStartedAt(seed.startedAt);
        attempt.setFinishedAt(seed.finishedAt);
        attempt.setResult(seed.result);
        attempt.setErrorCode(seed.errorCode);
        return attempts.save(attempt);
    }

    private TaskCheck persistCheck(CheckSeed seed) {
        TaskCheck check = new TaskCheck();
        check.setTaskId(seed.taskId);
        check.setKind(seed.kind);
        check.setName(seed.name);
        check.setApiResult(ApiResult.OK);
        check.setObserved(seed.kind == CheckKind.CHECK ? Observed.RUNNING : null);
        check.setPollCount(1);
        check.setStartedAt(seed.startedAt);
        check.setCheckedAt(seed.startedAt);
        return checks.save(check);
    }

    private PipelineEvent persistEvent(EventSeed seed) {
        PipelineEvent event = new PipelineEvent();
        event.setPipelineId(seed.pipelineId);
        event.setType(seed.type);
        event.setSeverity(seed.severity);
        event.setActor(Actor.SYSTEM);
        event.setCreatedAt(seed.createdAt);
        return events.save(event);
    }

    @lombok.Builder
    private static class PipelineSeed {
        private final String target;
        private final PipelineStatus status;
        private final Instant startedAt;
        private final Instant finishedAt;
    }

    @lombok.Builder
    private static class TaskSeed {
        private final Long pipelineId;
        private final int seq;
        private final String name;
        private final TaskKind kind;
        private final TaskStatus status;
    }

    @lombok.Builder
    private static class AttemptSeed {
        private final Long taskId;
        private final int attemptNo;
        private final Instant startedAt;
        private final Instant finishedAt;
        private final AttemptResult result;
        private final ErrorCode errorCode;
    }

    @lombok.Builder
    private static class CheckSeed {
        private final Long taskId;
        private final CheckKind kind;
        private final String name;
        private final Instant startedAt;
    }

    @lombok.Builder
    private static class EventSeed {
        private final Long pipelineId;
        private final String type;
        private final Severity severity;
        private final Instant createdAt;
    }
}
