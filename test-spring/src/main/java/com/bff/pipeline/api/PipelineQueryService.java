package com.bff.pipeline.api;

import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskCheckRepository;
import com.bff.pipeline.repo.TaskRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Read-only Admin queries (api §1). DTOs are camelCase (ADR-019 API layer). Derivations: progress {done,total},
 * latestCheck (max started_at), attempt outcome (from result+error_code), fail_reason. Board sort is restricted
 * to the indexed keys {@code lastActivityAt} / {@code startedAt}; an unsupported key falls back to the default.
 */
@Service
@Transactional(readOnly = true)
public class PipelineQueryService {

    private static final Set<PipelineStatus> NON_TERMINAL = EnumSet.of(PipelineStatus.RUNNING, PipelineStatus.CANCELLING);
    private static final Set<String> SORTABLE = Set.of("lastActivityAt", "startedAt");

    private final PipelineRepository pipelines;
    private final TaskRepository tasks;
    private final TaskAttemptRepository attempts;
    private final TaskCheckRepository checks;
    private final PipelineEventRepository events;

    public PipelineQueryService(PipelineRepository pipelines, TaskRepository tasks, TaskAttemptRepository attempts,
                                TaskCheckRepository checks, PipelineEventRepository events) {
        this.pipelines = pipelines;
        this.tasks = tasks;
        this.attempts = attempts;
        this.checks = checks;
        this.events = events;
    }

    public Page<PipelineSummary> list(PipelineListFilter filter, Pageable pageable) {
        return pipelines.findAll(specification(filter), sanitizeSort(pageable)).map(this::toSummary);
    }

    public PipelineDetail detail(Long pipelineId) {
        Pipeline pipeline = require(pipelineId);
        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipelineId);
        List<TaskView> views = chain.stream().map(this::toTaskView).toList();
        return new PipelineDetail(PipelineSummary.of(pipeline, Progress.of(chain)), views);
    }

    public TaskTimeline taskTimeline(Long pipelineId, Long taskId, Pageable checkPage) {
        Task task = tasks.findById(taskId)
                .filter(t -> t.getPipelineId().equals(pipelineId))
                .orElseThrow(() -> new IllegalArgumentException("no task " + taskId + " in pipeline " + pipelineId));
        List<AttemptView> attemptViews = attempts.findByTaskIdOrderByAttemptNoAsc(taskId).stream()
                .map(AttemptView::of).toList();
        Page<CheckView> checkViews = checks.findByTaskId(taskId, checkPage).map(CheckView::of);
        return new TaskTimeline(toTaskView(task), attemptViews, checkViews);
    }

    public Page<PipelineEventView> events(Long pipelineId, Severity severity, Pageable pageable) {
        Page<PipelineEvent> page = severity == null
                ? events.findByPipelineId(pipelineId, pageable)
                : events.findByPipelineIdAndSeverity(pipelineId, severity, pageable);
        return page.map(PipelineEventView::of);
    }

    /** "latest" = the non-terminal run for the target (≤1, Decision 5), else the most recent terminal run. */
    public PipelineSummary latest(String targetSourceId) {
        return pipelines.findFirstByTargetSourceIdAndStatusInOrderByStartedAtDesc(targetSourceId, NON_TERMINAL)
                .or(() -> pipelines.findFirstByTargetSourceIdOrderByStartedAtDesc(targetSourceId))
                .map(this::toSummary)
                .orElse(null);
    }

    private Pipeline require(Long pipelineId) {
        return pipelines.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("no pipeline " + pipelineId));
    }

    private PipelineSummary toSummary(Pipeline pipeline) {
        return PipelineSummary.of(pipeline, Progress.of(tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId())));
    }

    private TaskView toTaskView(Task task) {
        CheckView latest = CheckView.of(checks.findFirstByTaskIdOrderByStartedAtDescIdDesc(task.getId()).orElse(null));
        return TaskView.of(task, latest);
    }

    /** Keep only the allowed indexed sort keys; fall back to the default (lastActivityAt desc) if none remain. */
    private Pageable sanitizeSort(Pageable pageable) {
        Sort filtered = Sort.by(pageable.getSort().stream()
                .filter(order -> SORTABLE.contains(order.getProperty()))
                .toList());
        Sort effective = filtered.isSorted() ? filtered : Sort.by(Sort.Direction.DESC, "lastActivityAt");
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), effective);
    }

    private static Specification<Pipeline> specification(PipelineListFilter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            if (f.type() != null) {
                predicates.add(cb.equal(root.get("type"), f.type()));
            }
            if (f.provider() != null) {
                predicates.add(cb.equal(root.get("provider"), f.provider()));
            }
            if (f.targetSourceId() != null) {
                predicates.add(cb.equal(root.get("targetSourceId"), f.targetSourceId()));
            }
            // [from,to) overlaps the run's [startedAt, finishedAt): startedAt < to AND (finishedAt IS NULL OR > from).
            if (f.to() != null) {
                predicates.add(cb.lessThan(root.get("startedAt"), f.to()));
            }
            if (f.from() != null) {
                predicates.add(cb.or(cb.isNull(root.get("finishedAt")), cb.greaterThan(root.get("finishedAt"), f.from())));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
