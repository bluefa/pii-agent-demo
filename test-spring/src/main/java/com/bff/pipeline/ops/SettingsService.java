package com.bff.pipeline.ops;

import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.service.EventRecorder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Runtime settings (R5). These GLOBAL knobs are data: a {@link #put} takes effect immediately (a later
 * {@link #get} — and the next reconciler tick that reads them — sees the new value, no redeploy) and is
 * audited as a {@code SETTINGS:CHANGED} pipeline_event. The per-task duration knobs (ttl / pollingInterval /
 * executionTimeout / maxFailCount) are NOT editable here — they are frozen onto the task row at creation, so a
 * settings change never retroactively alters an in-flight run.
 */
@Service
public class SettingsService {

    private final SettingRepository settings;
    private final EventRecorder events;

    public SettingsService(SettingRepository settings, EventRecorder events) {
        this.settings = settings;
        this.events = events;
    }

    public Optional<String> get(String key) {
        return settings.findById(key).map(Setting::getValue);
    }

    @Transactional
    public void put(String key, String value, Actor actor) {
        Setting setting = settings.findById(key).orElseGet(Setting::new);
        setting.setKey(key);
        setting.setValue(value);
        settings.save(setting);
        events.recordPipelineEvent(null, null, "SETTINGS:CHANGED", Severity.INFO, actor, "{\"key\":\"" + key + "\"}");
    }
}
