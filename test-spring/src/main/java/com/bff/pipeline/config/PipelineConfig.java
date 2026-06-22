package com.bff.pipeline.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Wiring. A {@link Clock} bean makes the reconciler's time deterministic — tests inject a fixed clock.
 */
@Configuration
@EnableConfigurationProperties(PipelineSettings.class)
public class PipelineConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * The fire-and-forget pool for external calls (D-T2): the tick submits a dispatch/poll/check here and
     * returns immediately, so the reconciler loop never blocks on a slow IM call — the call runs on its own
     * virtual thread, writes the observation, and the NEXT tick reads it. A virtual-thread-per-task executor
     * is the Java 21 realization of "비블로킹 async 발사"; the per-tick {@code max_external_calls_per_tick}
     * budget is the V1 submission throttle (a fixed-pool hard cap is the implementation-notes §A refinement,
     * not an architecture invariant). Tests inject a same-thread executor so the fire→observe→advance split
     * stays deterministic. Spring shuts the ExecutorService down on context close.
     */
    @Bean
    public Executor pipelineCallExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
