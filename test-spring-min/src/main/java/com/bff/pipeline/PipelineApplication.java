package com.bff.pipeline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Minimal installation-pipeline orchestrator (minimal-redesign.md): a durable 5-state task machine driven by a
 * reconciler tick. The DB row is the state; restart resumes from it. Two task kinds, two tables, no async
 * single-writer split / observation ledger / outbox / alerts.
 */
@SpringBootApplication
@EnableScheduling
public class PipelineApplication {
    public static void main(String[] args) {
        SpringApplication.run(PipelineApplication.class, args);
    }
}
