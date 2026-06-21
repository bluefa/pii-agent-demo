package com.bff.pipeline.repo;

import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByPipelineIdOrderBySeqAsc(Long pipelineId);

    /**
     * Slot admission count (Decision 4b): {@code COUNT(task WHERE kind=TERRAFORM_JOB AND status IN
     * (DISPATCHING, RUNNING))}. Global across all pipelines — slotCap is a global submission throttle.
     */
    long countByKindAndStatusIn(TaskKind kind, Collection<TaskStatus> statuses);
}
