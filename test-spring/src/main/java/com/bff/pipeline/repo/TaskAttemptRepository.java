package com.bff.pipeline.repo;

import com.bff.pipeline.domain.TaskAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskAttemptRepository extends JpaRepository<TaskAttempt, Long> {

    /** the current (latest) attempt for a task. */
    Optional<TaskAttempt> findFirstByTaskIdOrderByAttemptNoDesc(Long taskId);

    List<TaskAttempt> findByTaskIdOrderByAttemptNoAsc(Long taskId);
}
