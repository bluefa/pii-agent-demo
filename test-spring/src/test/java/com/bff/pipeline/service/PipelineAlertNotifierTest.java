package com.bff.pipeline.service;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.repository.PipelineEventRepository;
import com.bff.pipeline.service.PipelineEventRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link PipelineAlertService#consume()} — the outbox consumer (Decision 1.3). {@code consume()} claims the
 * unsent rows ({@code notifiedAt IS NULL}, native {@code FOR UPDATE SKIP LOCKED}) and stamps {@code notifiedAt}
 * from the injected {@link Clock}; an already-stamped row is untouched and a second pass finds nothing
 * (idempotent). The native SKIP-LOCKED claim is exercised against H2 here to prove it parses (H2 2.2 /
 * Postgres both do).
 */
@DataJpaTest
@Import({PipelineAlertService.class, PipelineEventRecorder.class, PipelineAlertNotifierTest.Wiring.class})
class PipelineAlertNotifierTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");

    @TestConfiguration
    static class Wiring {
        @Bean
        Clock clock() {
            return Clock.fixed(FIXED, ZoneOffset.UTC);
        }

        @Bean
        PipelineEngineSettings pipelineEngineSettings() {
            return PipelineEngineSettings.builder().build();
        }
    }

    @Autowired
    private PipelineAlertService alerts;
    @Autowired
    private PipelineEventRepository events;

    @Test
    void consumeStampsOnlyUnsentRowsAndIsIdempotentOnASecondPass() {
        PipelineEvent unsentA = save("PIPELINE_CREATED", null, FIXED.minusSeconds(60));
        PipelineEvent unsentB = save("TASK_FAILED", null, FIXED.minusSeconds(30));
        PipelineEvent alreadySent = save("PIPELINE_DONE", FIXED.minusSeconds(120), FIXED.minusSeconds(90));

        int firstPass = alerts.consume();

        assertThat(firstPass).isEqualTo(2);
        assertThat(events.findById(unsentA.getId()).orElseThrow().getNotifiedAt()).isEqualTo(FIXED);
        assertThat(events.findById(unsentB.getId()).orElseThrow().getNotifiedAt()).isEqualTo(FIXED);
        assertThat(events.findById(alreadySent.getId()).orElseThrow().getNotifiedAt())
                .isEqualTo(FIXED.minusSeconds(120));

        int secondPass = alerts.consume();

        assertThat(secondPass).isEqualTo(0);
    }

    private PipelineEvent save(String type, Instant notifiedAt, Instant createdAt) {
        PipelineEvent event = new PipelineEvent();
        event.setType(type);
        event.setSeverity(Severity.INFO);
        event.setActor(Actor.SYSTEM);
        event.setCreatedAt(createdAt);
        event.setNotifiedAt(notifiedAt);
        return events.save(event);
    }
}
