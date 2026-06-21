package com.bff.pipeline.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Runtime operational settings (R5 — "settings are data"). Global knobs; per-task duration knobs
 * (ttl, pollingInterval, executionTimeout, maxFailCount) are frozen on the task row from the recipe and
 * these act only as defaults. {@code workerPoolSize} (M) is intentionally absent — it is the IM's deploy
 * setting (hard cap), not a BFF-editable knob.
 */
@ConfigurationProperties(prefix = "pipeline")
public class PipelineSettings {

    private Duration tickInterval = Duration.ofSeconds(30);
    private Duration perCallDeadline = Duration.ofSeconds(30);
    private Duration dispatchRecoveryTimeout = Duration.ofMinutes(5);
    private Duration executionTimeout = Duration.ofMinutes(30);
    private Duration waitExternalTtl = Duration.ofDays(7);
    private Duration conditionPollingGuard = Duration.ofMinutes(10);
    private Duration jobPollCadence = Duration.ofSeconds(45);

    /** slotCap (N) — BFF admission throttle (N ≈ workerPoolSize). soft, not a concurrency guarantee. */
    private int slotCap = 4;

    /** tick poll/check fire budget (dispatch excluded — gated by slotCap admission). */
    private int maxExternalCallsPerTick = 50;

    /** default K (max unsuccessful attempts); recipe may override per task. */
    private int maxFailCount = 3;

    private int taskCheckRetentionDays = 90;
    private Duration queueWaitAlert = Duration.ofMinutes(30);

    public Duration getTickInterval() { return tickInterval; }
    public void setTickInterval(Duration v) { this.tickInterval = v; }
    public Duration getPerCallDeadline() { return perCallDeadline; }
    public void setPerCallDeadline(Duration v) { this.perCallDeadline = v; }
    public Duration getDispatchRecoveryTimeout() { return dispatchRecoveryTimeout; }
    public void setDispatchRecoveryTimeout(Duration v) { this.dispatchRecoveryTimeout = v; }
    public Duration getExecutionTimeout() { return executionTimeout; }
    public void setExecutionTimeout(Duration v) { this.executionTimeout = v; }
    public Duration getWaitExternalTtl() { return waitExternalTtl; }
    public void setWaitExternalTtl(Duration v) { this.waitExternalTtl = v; }
    public Duration getConditionPollingGuard() { return conditionPollingGuard; }
    public void setConditionPollingGuard(Duration v) { this.conditionPollingGuard = v; }
    public Duration getJobPollCadence() { return jobPollCadence; }
    public void setJobPollCadence(Duration v) { this.jobPollCadence = v; }
    public int getSlotCap() { return slotCap; }
    public void setSlotCap(int v) { this.slotCap = v; }
    public int getMaxExternalCallsPerTick() { return maxExternalCallsPerTick; }
    public void setMaxExternalCallsPerTick(int v) { this.maxExternalCallsPerTick = v; }
    public int getMaxFailCount() { return maxFailCount; }
    public void setMaxFailCount(int v) { this.maxFailCount = v; }
    public int getTaskCheckRetentionDays() { return taskCheckRetentionDays; }
    public void setTaskCheckRetentionDays(int v) { this.taskCheckRetentionDays = v; }
    public Duration getQueueWaitAlert() { return queueWaitAlert; }
    public void setQueueWaitAlert(Duration v) { this.queueWaitAlert = v; }
}
