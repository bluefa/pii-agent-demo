package com.bff.pipeline.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * The reconciler's operational knobs (bound once from {@code application.yml}). Per §8 the minimal design keeps
 * settings global rather than freezing a copy per task; a task may still carry its own override (see
 * {@code Task.executionTimeout / ttl / pollingInterval / maxFailCount}), and the reconciler falls back to these
 * when a task leaves one null.
 *
 * <p>{@link #defaults()} is the no-Spring test seam: a unit test builds it directly and uses
 * {@link #withTtl}/{@link #withExecutionTimeout}/... to vary just the knob under test.
 */
@Getter
@Configuration
public class PipelineSettings {

    /** how often the reconciler reconciles every RUNNING pipeline's current task. */
    private final Duration tickInterval;
    /** abandon a single IM dispatch/poll call once it exceeds this (CALL_TIMEOUT). */
    private final Duration perCallTimeout;
    /** default TERRAFORM_JOB dispatch->terminal deadline (EXECUTION_TIMEOUT) when the task has none. */
    private final Duration executionTimeout;
    /** default CONDITION_CHECK total-residence deadline (TTL_EXPIRED) when the task has none. */
    private final Duration ttl;
    /** default CONDITION_CHECK re-poll cadence when the task has none. */
    private final Duration pollingInterval;
    /** default retries before a task FAILS when the task has none. */
    private final int maxFailCount;
    /** bounded worker pool size for the synchronous IM calls. */
    private final int workerPoolSize;

    public PipelineSettings(
            @Value("${pipeline.tick-interval}") Duration tickInterval,
            @Value("${pipeline.per-call-timeout}") Duration perCallTimeout,
            @Value("${pipeline.execution-timeout}") Duration executionTimeout,
            @Value("${pipeline.ttl}") Duration ttl,
            @Value("${pipeline.polling-interval}") Duration pollingInterval,
            @Value("${pipeline.max-fail-count}") int maxFailCount,
            @Value("${pipeline.worker-pool-size}") int workerPoolSize) {
        this.tickInterval = tickInterval;
        this.perCallTimeout = perCallTimeout;
        this.executionTimeout = executionTimeout;
        this.ttl = ttl;
        this.pollingInterval = pollingInterval;
        this.maxFailCount = maxFailCount;
        this.workerPoolSize = workerPoolSize;
    }

    /** The deploy defaults as a no-Spring instance (the test seam). */
    public static PipelineSettings defaults() {
        return new PipelineSettings(Duration.ofSeconds(15), Duration.ofSeconds(30), Duration.ofMinutes(30),
                Duration.ofDays(7), Duration.ofMinutes(10), 3, 8);
    }

    public PipelineSettings withPerCallTimeout(Duration v) {
        return new PipelineSettings(tickInterval, v, executionTimeout, ttl, pollingInterval, maxFailCount, workerPoolSize);
    }

    public PipelineSettings withExecutionTimeout(Duration v) {
        return new PipelineSettings(tickInterval, perCallTimeout, v, ttl, pollingInterval, maxFailCount, workerPoolSize);
    }

    public PipelineSettings withTtl(Duration v) {
        return new PipelineSettings(tickInterval, perCallTimeout, executionTimeout, v, pollingInterval, maxFailCount, workerPoolSize);
    }

    public PipelineSettings withPollingInterval(Duration v) {
        return new PipelineSettings(tickInterval, perCallTimeout, executionTimeout, ttl, v, maxFailCount, workerPoolSize);
    }

    public PipelineSettings withMaxFailCount(int v) {
        return new PipelineSettings(tickInterval, perCallTimeout, executionTimeout, ttl, pollingInterval, v, workerPoolSize);
    }
}
