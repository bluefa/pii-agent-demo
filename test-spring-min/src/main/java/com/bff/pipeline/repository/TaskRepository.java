package com.bff.pipeline.repository;

import com.bff.pipeline.domain.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    /** all tasks of a pipeline in chain order — the reconciler picks the lowest-seq non-terminal one. */
    List<Task> findByPipelineIdOrderBySeqAsc(Long pipelineId);
}
