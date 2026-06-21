package com.bff.pipeline.ops;

import com.bff.pipeline.config.PipelineSettings;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RuntimeSettings is the R5 read side: a DB {@code setting} row overrides the {@link PipelineSettings}
 * default, immediately (the next read sees it) — which is what makes a SettingsService.put actually take
 * effect on the next tick / next run, not just sit in a table.
 */
@DataJpaTest
class RuntimeSettingsTest {

    @Autowired
    private SettingRepository settings;

    private RuntimeSettings runtimeSettings() {
        return new RuntimeSettings(new PipelineSettings(), settings);
    }

    @Test
    void getReturnsThePipelineSettingsDefaultWhenNoDbOverride() {
        PipelineSettings defaults = new PipelineSettings();
        assertThat(runtimeSettings().getSlotCap()).isEqualTo(defaults.getSlotCap());
        assertThat(runtimeSettings().getExecutionTimeout()).isEqualTo(defaults.getExecutionTimeout());
        assertThat(runtimeSettings().getMaxFailCount()).isEqualTo(defaults.getMaxFailCount());
    }

    @Test
    void getReturnsTheDbOverrideWhenPresent() {
        save("slotCap", "9");
        save("executionTimeout", "PT5M");

        assertThat(runtimeSettings().getSlotCap()).isEqualTo(9);
        assertThat(runtimeSettings().getExecutionTimeout()).isEqualTo(Duration.ofMinutes(5));
    }

    private void save(String key, String value) {
        Setting setting = new Setting();
        setting.setKey(key);
        setting.setValue(value);
        settings.save(setting);
    }
}
