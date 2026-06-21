package com.bff.pipeline.repo;

import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.Severity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PipelineEventRepository extends JpaRepository<PipelineEvent, Long> {

    List<PipelineEvent> findByPipelineIdOrderByCreatedAtAsc(Long pipelineId);

    /** the Notifier's outbox cursor — unsent events (notifiedAt IS NULL). */
    List<PipelineEvent> findByNotifiedAtIsNullOrderByCreatedAtAsc();

    // ---- Admin audit-log queries (api §1) ----
    Page<PipelineEvent> findByPipelineId(Long pipelineId, Pageable pageable);

    Page<PipelineEvent> findByPipelineIdAndSeverity(Long pipelineId, Severity severity, Pageable pageable);
}
