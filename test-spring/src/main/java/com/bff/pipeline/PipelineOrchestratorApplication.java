package com.bff.pipeline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ADR-016 V1 reference implementation — BFF-internal durable state machine + reconciler tick.
 *
 * <p>Scope: Decisions 1–7 of ADR-016 V1, EXCLUDING the v2-deferred task-detail capture
 * (postCheck / {@code task_check.detail}). External boundaries (Infra Manager HTTP, Postgres
 * advisory-lock leadership) are interfaces so the state machine is unit-testable in isolation.
 */
@SpringBootApplication
@EnableScheduling
public class PipelineOrchestratorApplication {
    public static void main(String[] args) {
        SpringApplication.run(PipelineOrchestratorApplication.class, args);
    }
}
