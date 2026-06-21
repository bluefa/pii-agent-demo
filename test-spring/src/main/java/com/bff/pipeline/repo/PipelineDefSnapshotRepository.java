package com.bff.pipeline.repo;

import com.bff.pipeline.domain.PipelineDefSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PipelineDefSnapshotRepository extends JpaRepository<PipelineDefSnapshot, Long> {
}
