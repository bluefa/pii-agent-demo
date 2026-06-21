package com.bff.pipeline.ops;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.service.EventRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link SettingsService} — runtime knobs are data (R5). A {@code put} upserts the {@link Setting} row (so a
 * later {@code get} sees the new value, no redeploy) and audits the change as a {@code SETTINGS:CHANGED}
 * outbox event. A second {@code put} on the same key updates the value in place (still one row), not a
 * second row.
 */
@DataJpaTest
@Import({SettingsService.class, EventRecorder.class, SettingsServiceTest.Wiring.class})
class SettingsServiceTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");
    private static final String KEY = "pipeline.slotCap";

    @TestConfiguration
    static class Wiring {
        @Bean
        Clock clock() {
            return Clock.fixed(FIXED, ZoneOffset.UTC);
        }

        @Bean
        PipelineSettings pipelineSettings() {
            return new PipelineSettings();
        }
    }

    @Autowired
    private SettingsService settings;
    @Autowired
    private SettingRepository settingRepository;
    @Autowired
    private PipelineEventRepository events;

    @Test
    void putStoresTheValueAndAuditsASettingsChangedEvent() {
        settings.put(KEY, "8", Actor.HUMAN);

        assertThat(settings.get(KEY)).contains("8");
        assertThat(events.findAll().stream().map(e -> e.getType()).toList())
                .contains("SETTINGS:CHANGED");
    }

    @Test
    void secondPutOnTheSameKeyUpdatesTheValueInPlace() {
        settings.put(KEY, "8", Actor.HUMAN);
        settings.put(KEY, "2", Actor.HUMAN);

        assertThat(settings.get(KEY)).contains("2");
        List<Setting> rows = settingRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getValue()).isEqualTo("2");
    }
}
