package com.bff.pipeline.config;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;

import java.time.Duration;

/**
 * Immutable snapshot of the pipeline engine's operational knobs (R5 — "settings are data"). Assembled once at
 * startup by {@link PipelineEngineConfig} from the {@code @Value} bindings and injected into the reconciler,
 * the creation freeze, the external-call cadences, and the alerting — so every knob reads one way everywhere.
 *
 * <p>The {@code @Builder.Default} values are the canonical fallbacks, so a unit test's
 * {@code PipelineEngineSettings.builder().build()} reproduces the deploy defaults without a Spring context.
 * The rich per-knob description lives on the {@link PipelineEngineConfig} {@code @Value} parameters (the
 * documented configuration surface).
 *
 * <p>Per-task duration knobs (ttl / pollingInterval / executionTimeout / maxFailCount) are frozen onto the
 * task row at creation, so changing a knob never retroactively alters an in-flight run. {@code workerPoolSize}
 * is intentionally absent — it is the IM's deploy setting (slotCap ≈ workerPoolSize), not a BFF knob.
 */
@Getter
@Builder
public class PipelineEngineSettings {

    /** PipelineReconciler tick cadence — how often the engine reconciles every non-terminal task. */
    @NonNull
    @Builder.Default
    private final Duration tickInterval = Duration.ofSeconds(30);

    /** Per-call deadline — a single IM dispatch/poll/check is abandoned (CALL_TIMEOUT) once it exceeds this. */
    @NonNull
    @Builder.Default
    private final Duration perCallDeadline = Duration.ofSeconds(30);

    /** DISPATCHING recovery window — how long a dispatch may stay un-acknowledged before recovery decides. */
    @NonNull
    @Builder.Default
    private final Duration dispatchRecoveryTimeout = Duration.ofMinutes(5);

    /** TERRAFORM_JOB dispatch→terminal execution timeout default (a recipe may override per task). */
    @NonNull
    @Builder.Default
    private final Duration executionTimeout = Duration.ofMinutes(30);

    /** CONDITION_CHECK total-residence TTL before the wait EXPIRES, default (a recipe may override per task). */
    @NonNull
    @Builder.Default
    private final Duration waitExternalTtl = Duration.ofDays(7);

    /** CONDITION_CHECK polling-cadence floor (≥10m guard) so a condition is never hammered. */
    @NonNull
    @Builder.Default
    private final Duration conditionPollingGuard = Duration.ofMinutes(10);

    /** TERRAFORM_JOB job-poll cadence — how often a RUNNING job's status is re-polled. */
    @NonNull
    @Builder.Default
    private final Duration jobPollCadence = Duration.ofSeconds(45);

    /** Queue-wait alert threshold — a READY TERRAFORM_JOB waiting longer than this raises an alert. */
    @NonNull
    @Builder.Default
    private final Duration queueWaitAlert = Duration.ofMinutes(30);

    /** slotCap (N) — BFF admission throttle (N ≈ IM workerPoolSize); soft, not a concurrency guarantee. */
    @Builder.Default
    private final int slotCap = 4;

    /** Per-tick poll/check fire budget (dispatch is excluded — that is gated by slotCap admission). */
    @Builder.Default
    private final int maxExternalCallsPerTick = 50;

    /** Default K — max unsuccessful attempts before a task FAILS (a recipe may override per task). */
    @Builder.Default
    private final int maxFailCount = 3;

    /** task_check retention horizon in days — RLE-collapsed observations older than this are pruned. */
    @Builder.Default
    private final int taskCheckRetentionDays = 90;
}
