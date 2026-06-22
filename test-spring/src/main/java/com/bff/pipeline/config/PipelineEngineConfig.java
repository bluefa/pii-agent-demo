package com.bff.pipeline.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Global configuration of the pipeline engine's operational knobs (R5 — "settings are data"). This is the
 * single documented source of every runtime knob: each value is declared in {@code application.yml} under
 * {@code pipeline.*} and bound here with {@code @Value}, then assembled into one immutable
 * {@link PipelineEngineSettings} bean the engine injects. A deploy-time change is a one-line yaml edit.
 *
 * <p>This replaces the former DB-overlaid {@code RuntimeSettings}: V1 keeps the knobs deploy-time (yaml, no
 * runtime PUT). The per-task freeze semantics are unchanged — knobs are still snapshotted onto the task row
 * at creation, so an in-flight run is never retroactively re-tuned.
 */
@Configuration
public class PipelineEngineConfig {

    /**
     * Bind every {@code pipeline.*} knob from {@code application.yml} and assemble the immutable settings bean.
     *
     * @param tickInterval            reconciler tick cadence — how often every non-terminal task is reconciled
     * @param perCallDeadline         per external-call deadline before CALL_TIMEOUT abandons the single call
     * @param dispatchRecoveryTimeout how long a dispatch may stay un-acknowledged before recovery decides
     * @param executionTimeout        TERRAFORM_JOB dispatch→terminal execution timeout default
     * @param waitExternalTtl         CONDITION_CHECK total-residence TTL before the wait EXPIRES (default)
     * @param conditionPollingGuard   CONDITION_CHECK polling-cadence floor (≥10m) so a condition is not hammered
     * @param jobPollCadence          TERRAFORM_JOB job-poll cadence for a RUNNING job's status
     * @param queueWaitAlert          READY-queue wait threshold that raises a queue-wait alert
     * @param slotCap                 BFF admission throttle N (≈ IM workerPoolSize); soft, not a guarantee
     * @param maxExternalCallsPerTick per-tick poll/check fire budget (dispatch excluded — gated by slotCap)
     * @param maxFailCount            default K — max unsuccessful attempts before a task FAILS
     * @param taskCheckRetentionDays  task_check retention horizon in days before RLE rows are pruned
     */
    @Bean
    public PipelineEngineSettings pipelineEngineSettings(
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
        return PipelineEngineSettings.builder()
                .tickInterval(tickInterval)
                .perCallDeadline(perCallDeadline)
                .dispatchRecoveryTimeout(dispatchRecoveryTimeout)
                .executionTimeout(executionTimeout)
                .waitExternalTtl(waitExternalTtl)
                .conditionPollingGuard(conditionPollingGuard)
                .jobPollCadence(jobPollCadence)
                .queueWaitAlert(queueWaitAlert)
                .slotCap(slotCap)
                .maxExternalCallsPerTick(maxExternalCallsPerTick)
                .maxFailCount(maxFailCount)
                .taskCheckRetentionDays(taskCheckRetentionDays)
                .build();
    }
}
