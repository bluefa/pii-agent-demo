package com.bff.pipeline.service;
import com.bff.pipeline.dto.PipelineDetail;
import com.bff.pipeline.dto.PipelineListFilter;
import com.bff.pipeline.dto.Progress;
import com.bff.pipeline.dto.TaskTimeline;

import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.entity.TaskCheck;
import com.bff.pipeline.type.AttemptOutcome;
import com.bff.pipeline.type.AttemptResult;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskAttemptRepository;
import com.bff.pipeline.repository.TaskCheckRepository;
import com.bff.pipeline.repository.TaskRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Read-only Admin queries (api §1). Returns entities; the only non-entity results bundle several entities
 * plus a computed value ({@link PipelineDetail}, {@link TaskTimeline}). Derivations: progress {done,total},
 * latestCheck (max started_at), attempt outcome (from result+error_code). Board sort is restricted to the
 * indexed keys {@code lastActivityAt} / {@code startedAt}; an unsupported key falls back to the default.
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

    public Page<Pipeline> list(PipelineListFilter filter, Pageable pageable) {
        return pipelines.findAll(specification(filter), sanitizeSort(pageable));
    }

    public PipelineDetail detail(Long pipelineId) {
        Pipeline pipeline = require(pipelineId);
        List<Task> chain = tasks.findByPipelineIdOrderBySeqAsc(pipelineId);
        return PipelineDetail.builder().pipeline(pipeline).tasks(chain).progress(Progress.of(chain)).build();
    }

    public TaskTimeline taskTimeline(Long pipelineId, Long taskId, Pageable checkPage) {
        Task task = tasks.findById(taskId)
                .filter(t -> t.getPipelineId().equals(pipelineId))
                .orElseThrow(() -> new IllegalArgumentException("no task " + taskId + " in pipeline " + pipelineId));
        List<TaskAttempt> taskAttempts = attempts.findByTaskIdOrderByAttemptNoAsc(taskId);
        Page<TaskCheck> taskChecks = checks.findByTaskId(taskId, defaultCheckSort(checkPage));
        return TaskTimeline.builder().task(task).attempts(taskAttempts).checks(taskChecks).build();
    }

    /** Attempt outcome (api §0): derived from {@code result + error_code}; null while the attempt is in-flight. */
    @Nullable
    public static AttemptOutcome outcomeOf(TaskAttempt attempt) {
        if (attempt.getFinishedAt() == null) {
            return null; // in-flight: no outcome yet
        }
        if (attempt.getResult() == AttemptResult.OK) {
            return AttemptOutcome.SUCCEEDED;
        }
        return attempt.getErrorCode() == ErrorCode.EXECUTION_TIMEOUT
                ? AttemptOutcome.EXECUTION_TIMEOUT : AttemptOutcome.FAILED;
    }

    /** The task's current observation run (max started_at), null if unobserved. */
    @Nullable
    public TaskCheck latestCheck(Long taskId) {
        return checks.findFirstByTaskIdOrderByStartedAtDescIdDesc(taskId).orElse(null);
    }

    /** Checks default to {@code startedAt desc} (api §1) when the caller specified no sort. */
    private static Pageable defaultCheckSort(Pageable pageable) {
        return pageable.getSort().isSorted() ? pageable : PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "startedAt"));
    }

    public Page<PipelineEvent> events(Long pipelineId, @Nullable Severity severity, Pageable pageable) {
        return severity == null
                ? events.findByPipelineId(pipelineId, pageable)
                : events.findByPipelineIdAndSeverity(pipelineId, severity, pageable);
    }

    /** "latest" = the non-terminal run for the target (≤1, Decision 5), else the most recent terminal run. */
    @Nullable
    public Pipeline latest(String targetSourceId) {
        return pipelines.findFirstByTargetSourceIdAndStatusInOrderByStartedAtDesc(targetSourceId, NON_TERMINAL)
                .or(() -> pipelines.findFirstByTargetSourceIdOrderByStartedAtDesc(targetSourceId))
                .orElse(null);
    }

    private Pipeline require(Long pipelineId) {
        return pipelines.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("no pipeline " + pipelineId));
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
            if (f.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), f.getStatus()));
            }
            if (f.getType() != null) {
                predicates.add(cb.equal(root.get("type"), f.getType()));
            }
            if (f.getProvider() != null) {
                predicates.add(cb.equal(root.get("provider"), f.getProvider()));
            }
            if (f.getTargetSourceId() != null) {
                predicates.add(cb.equal(root.get("targetSourceId"), f.getTargetSourceId()));
            }
            // [from,to) overlaps the run's [startedAt, finishedAt): startedAt < to AND (finishedAt IS NULL OR > from).
            if (f.getTo() != null) {
                predicates.add(cb.lessThan(root.get("startedAt"), f.getTo()));
            }
            if (f.getFrom() != null) {
                predicates.add(cb.or(cb.isNull(root.get("finishedAt")), cb.greaterThan(root.get("finishedAt"), f.getFrom())));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
