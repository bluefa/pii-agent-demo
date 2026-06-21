package com.bff.pipeline.repo;

import com.bff.pipeline.domain.PipelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PipelineEventRepository extends JpaRepository<PipelineEvent, Long> {

    List<PipelineEvent> findByPipelineIdOrderByCreatedAtAsc(Long pipelineId);

    /** the Notifier's outbox cursor — unsent events (notifiedAt IS NULL). */
    List<PipelineEvent> findByNotifiedAtIsNullOrderByCreatedAtAsc();
}
