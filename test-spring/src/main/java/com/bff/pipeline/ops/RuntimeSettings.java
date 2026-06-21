package com.bff.pipeline.ops;

import com.bff.pipeline.config.PipelineSettings;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * The runtime view of the operational settings (R5 — "settings are data"). Each getter returns the
 * DB-stored override (a {@code setting} row written by {@link SettingsService}, keyed by the field name)
 * when present, else the deploy-time {@link PipelineSettings} default — so a settings change takes effect on
 * the next read (the next tick, the next run's freeze) with no redeploy. The reconciler, the creation freeze,
 * the external-call cadences, and the alerts read THIS, not {@link PipelineSettings} directly. {@code
 * workerPoolSize} is intentionally absent — it is a deploy setting, not a runtime knob.
 */
@Component
public class RuntimeSettings {

    private final PipelineSettings defaults;
    private final SettingRepository settings;

    public RuntimeSettings(PipelineSettings defaults, SettingRepository settings) {
        this.defaults = defaults;
        this.settings = settings;
    }

    public int getSlotCap() {
        return intSetting("slotCap", defaults.getSlotCap());
    }

    public int getMaxExternalCallsPerTick() {
        return intSetting("maxExternalCallsPerTick", defaults.getMaxExternalCallsPerTick());
    }

    public int getMaxFailCount() {
        return intSetting("maxFailCount", defaults.getMaxFailCount());
    }

    public int getTaskCheckRetentionDays() {
        return intSetting("taskCheckRetentionDays", defaults.getTaskCheckRetentionDays());
    }

    public Duration getExecutionTimeout() {
        return durationSetting("executionTimeout", defaults.getExecutionTimeout());
    }

    public Duration getWaitExternalTtl() {
        return durationSetting("waitExternalTtl", defaults.getWaitExternalTtl());
    }

    public Duration getConditionPollingGuard() {
        return durationSetting("conditionPollingGuard", defaults.getConditionPollingGuard());
    }

    public Duration getJobPollCadence() {
        return durationSetting("jobPollCadence", defaults.getJobPollCadence());
    }

    public Duration getPerCallDeadline() {
        return durationSetting("perCallDeadline", defaults.getPerCallDeadline());
    }

    public Duration getDispatchRecoveryTimeout() {
        return durationSetting("dispatchRecoveryTimeout", defaults.getDispatchRecoveryTimeout());
    }

    public Duration getTickInterval() {
        return durationSetting("tickInterval", defaults.getTickInterval());
    }

    public Duration getQueueWaitAlert() {
        return durationSetting("queueWaitAlert", defaults.getQueueWaitAlert());
    }

    private int intSetting(String key, int fallback) {
        return settings.findById(key).map(s -> Integer.parseInt(s.getValue())).orElse(fallback);
    }

    private Duration durationSetting(String key, Duration fallback) {
        return settings.findById(key).map(s -> Duration.parse(s.getValue())).orElse(fallback);
    }
}
