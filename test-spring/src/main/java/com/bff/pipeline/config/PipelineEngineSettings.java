package com.bff.pipeline.config;

import lombok.Getter;
import lombok.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * The pipeline engine's operational knobs (R5 — "settings are data"), bound once at startup and read one way
 * everywhere (the reconciler, the creation freeze, the external-call cadences, the alerting). This single
 * {@code @Configuration} both binds the knobs from {@code application.yml} ({@code pipeline.*} via the
 * {@code @Value} constructor) and is the immutable value object the engine injects — there is no runtime
 * overlay, so no separate builder-reassembly config is warranted.
 *
 * <p>The {@link #builder()} path is the test seam: {@code PipelineEngineSettings.builder().build()} reproduces
 * the deploy defaults (the {@code DEFAULT_*} constants) without a Spring context, and a test overrides only the
 * one or two knobs it exercises. Spring itself always supplies every knob via {@code @Value}, so the defaults
 * never apply at runtime.
 *
 * <p>Per-task duration knobs (executionTimeout / waitExternalTtl / maxFailCount) are frozen onto the task row
 * at creation, so changing a knob never retroactively alters an in-flight run. {@code workerPoolSize} is
 * intentionally absent — it is the IM's deploy setting (slotCap ≈ workerPoolSize), not a BFF knob.
 */
@Getter
@Configuration
public class PipelineEngineSettings {

    private static final Duration DEFAULT_TICK_INTERVAL = Duration.ofSeconds(30);
    private static final Duration DEFAULT_PER_CALL_DEADLINE = Duration.ofSeconds(30);
    private static final Duration DEFAULT_DISPATCH_RECOVERY_TIMEOUT = Duration.ofMinutes(5);
    private static final Duration DEFAULT_EXECUTION_TIMEOUT = Duration.ofMinutes(30);
    private static final Duration DEFAULT_WAIT_EXTERNAL_TTL = Duration.ofDays(7);
    private static final Duration DEFAULT_CONDITION_POLLING_GUARD = Duration.ofMinutes(10);
    private static final Duration DEFAULT_JOB_POLL_CADENCE = Duration.ofSeconds(45);
    private static final Duration DEFAULT_QUEUE_WAIT_ALERT = Duration.ofMinutes(30);
    private static final int DEFAULT_SLOT_CAP = 4;
    private static final int DEFAULT_MAX_EXTERNAL_CALLS_PER_TICK = 50;
    private static final int DEFAULT_MAX_FAIL_COUNT = 3;
    private static final int DEFAULT_TASK_CHECK_RETENTION_DAYS = 90;

    /** PipelineReconciler tick cadence — how often the engine reconciles every non-terminal task. */
    @NonNull
    private final Duration tickInterval;

    /** Per-call deadline — a single IM dispatch/poll/check is abandoned (CALL_TIMEOUT) once it exceeds this. */
    @NonNull
    private final Duration perCallDeadline;

    /** DISPATCHING recovery window — how long a dispatch may stay un-acknowledged before recovery decides. */
    @NonNull
    private final Duration dispatchRecoveryTimeout;

    /** TERRAFORM_JOB dispatch→terminal execution timeout default (a recipe may override per task). */
    @NonNull
    private final Duration executionTimeout;

    /** CONDITION_CHECK total-residence TTL before the wait EXPIRES, default (a recipe may override per task). */
    @NonNull
    private final Duration waitExternalTtl;

    /** CONDITION_CHECK polling-cadence floor (≥10m guard) so a condition is never hammered. */
    @NonNull
    private final Duration conditionPollingGuard;

    /** TERRAFORM_JOB job-poll cadence — how often a RUNNING job's status is re-polled. */
    @NonNull
    private final Duration jobPollCadence;

    /** Queue-wait alert threshold — a READY TERRAFORM_JOB waiting longer than this raises an alert. */
    @NonNull
    private final Duration queueWaitAlert;

    /** slotCap (N) — BFF admission throttle (N ≈ IM workerPoolSize); soft, not a concurrency guarantee. */
    private final int slotCap;

    /** Per-tick poll/check fire budget (dispatch is excluded — that is gated by slotCap admission). */
    private final int maxExternalCallsPerTick;

    /** Default K — max unsuccessful attempts before a task FAILS (a recipe may override per task). */
    private final int maxFailCount;

    /** task_check retention horizon in days — RLE-collapsed observations older than this are pruned. */
    private final int taskCheckRetentionDays;

    /** Spring binds every {@code pipeline.*} knob from {@code application.yml} into the immutable settings. */
    public PipelineEngineSettings(
            @Value("${pipeline.tick-interval}") Duration tickInterval,
            @Value("${pipeline.per-call-deadline}") Duration perCallDeadline,
            @Value("${pipeline.dispatch-recovery-timeout}") Duration dispatchRecoveryTimeout,
            @Value("${pipeline.execution-timeout}") Duration executionTimeout,
            @Value("${pipeline.wait-external-ttl}") Duration waitExternalTtl,
            @Value("${pipeline.condition-polling-guard}") Duration conditionPollingGuard,
            @Value("${pipeline.job-poll-cadence}") Duration jobPollCadence,
            @Value("${pipeline.queue-wait-alert}") Duration queueWaitAlert,
            @Value("${pipeline.slot-cap}") int slotCap,
            @Value("${pipeline.max-external-calls-per-tick}") int maxExternalCallsPerTick,
            @Value("${pipeline.max-fail-count}") int maxFailCount,
            @Value("${pipeline.task-check-retention-days}") int taskCheckRetentionDays) {
        this.tickInterval = tickInterval;
        this.perCallDeadline = perCallDeadline;
        this.dispatchRecoveryTimeout = dispatchRecoveryTimeout;
        this.executionTimeout = executionTimeout;
        this.waitExternalTtl = waitExternalTtl;
        this.conditionPollingGuard = conditionPollingGuard;
        this.jobPollCadence = jobPollCadence;
        this.queueWaitAlert = queueWaitAlert;
        this.slotCap = slotCap;
        this.maxExternalCallsPerTick = maxExternalCallsPerTick;
        this.maxFailCount = maxFailCount;
        this.taskCheckRetentionDays = taskCheckRetentionDays;
    }

    /** A builder seeded with the deploy defaults — the no-Spring test seam (override only the knobs under test). */
    public static Builder builder() {
        return new Builder();
    }

    /** Mutable builder over the knob defaults; {@link #build()} produces the immutable settings. */
    public static final class Builder {
        private Duration tickInterval = DEFAULT_TICK_INTERVAL;
        private Duration perCallDeadline = DEFAULT_PER_CALL_DEADLINE;
        private Duration dispatchRecoveryTimeout = DEFAULT_DISPATCH_RECOVERY_TIMEOUT;
        private Duration executionTimeout = DEFAULT_EXECUTION_TIMEOUT;
        private Duration waitExternalTtl = DEFAULT_WAIT_EXTERNAL_TTL;
        private Duration conditionPollingGuard = DEFAULT_CONDITION_POLLING_GUARD;
        private Duration jobPollCadence = DEFAULT_JOB_POLL_CADENCE;
        private Duration queueWaitAlert = DEFAULT_QUEUE_WAIT_ALERT;
        private int slotCap = DEFAULT_SLOT_CAP;
        private int maxExternalCallsPerTick = DEFAULT_MAX_EXTERNAL_CALLS_PER_TICK;
        private int maxFailCount = DEFAULT_MAX_FAIL_COUNT;
        private int taskCheckRetentionDays = DEFAULT_TASK_CHECK_RETENTION_DAYS;

        public Builder tickInterval(Duration v) { this.tickInterval = v; return this; }
        public Builder perCallDeadline(Duration v) { this.perCallDeadline = v; return this; }
        public Builder dispatchRecoveryTimeout(Duration v) { this.dispatchRecoveryTimeout = v; return this; }
        public Builder executionTimeout(Duration v) { this.executionTimeout = v; return this; }
        public Builder waitExternalTtl(Duration v) { this.waitExternalTtl = v; return this; }
        public Builder conditionPollingGuard(Duration v) { this.conditionPollingGuard = v; return this; }
        public Builder jobPollCadence(Duration v) { this.jobPollCadence = v; return this; }
        public Builder queueWaitAlert(Duration v) { this.queueWaitAlert = v; return this; }
        public Builder slotCap(int v) { this.slotCap = v; return this; }
        public Builder maxExternalCallsPerTick(int v) { this.maxExternalCallsPerTick = v; return this; }
        public Builder maxFailCount(int v) { this.maxFailCount = v; return this; }
        public Builder taskCheckRetentionDays(int v) { this.taskCheckRetentionDays = v; return this; }

        public PipelineEngineSettings build() {
            return new PipelineEngineSettings(tickInterval, perCallDeadline, dispatchRecoveryTimeout,
                    executionTimeout, waitExternalTtl, conditionPollingGuard, jobPollCadence, queueWaitAlert,
                    slotCap, maxExternalCallsPerTick, maxFailCount, taskCheckRetentionDays);
        }
    }
}
