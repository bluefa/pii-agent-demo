package com.bff.pipeline.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Wiring. An injected {@link Clock} makes the reconciler's time deterministic (tests inject a fixed clock); a
 * bounded pool runs the synchronous IM dispatch/poll calls so one slow call's per-call timeout can be enforced
 * with {@code future.get(perCallTimeout)} without pinning the tick thread to it.
 */
@Configuration
public class PipelineConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean(destroyMethod = "shutdown")
    public ExecutorService imCallPool(PipelineSettings settings) {
        return Executors.newFixedThreadPool(settings.getWorkerPoolSize());
    }
}
