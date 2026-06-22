package com.bff.pipeline.service;

import com.bff.pipeline.dto.PipelineEventRecord;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.entity.PipelineEvent;
import com.bff.pipeline.type.Severity;
import com.bff.pipeline.repository.PipelineEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link PipelineEventRecorder} outbox write side. The recorder is constructed manually with the real repository
 * and a fixed {@link Clock} so {@code createdAt} is deterministic; {@code notifiedAt} must stay null (the
 * PipelineAlertNotifier stamps it on send, not the write side).
 */
@DataJpaTest
class PipelineEventRecorderTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");

    @Autowired
    private PipelineEventRepository events;

    @Test
    void recordPipelineEventInsertsRowWithFixedClockAndUnsentNotifiedAt() {
        PipelineEventRecorder recorder = new PipelineEventRecorder(events, Clock.fixed(FIXED, ZoneOffset.UTC));

        PipelineEvent saved = recorder.recordPipelineEvent(PipelineEventRecord.builder()
                .pipelineId(7L).taskId(42L).type("TASK_FAILED").severity(Severity.CRITICAL)
                .actor(Actor.SYSTEM).payload("{\"code\":\"JOB_FAILED\"}").build());

        PipelineEvent reloaded = events.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPipelineId()).isEqualTo(7L);
        assertThat(reloaded.getTaskId()).isEqualTo(42L);
        assertThat(reloaded.getType()).isEqualTo("TASK_FAILED");
        assertThat(reloaded.getSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(reloaded.getActor()).isEqualTo(Actor.SYSTEM);
        assertThat(reloaded.getPayload()).isEqualTo("{\"code\":\"JOB_FAILED\"}");
        assertThat(reloaded.getCreatedAt()).isEqualTo(FIXED);
        assertThat(reloaded.getNotifiedAt()).isNull();
    }

    @Test
    void recordGlobalEventInsertsRowWithNullPipelineId() {
        PipelineEventRecorder recorder = new PipelineEventRecorder(events, Clock.fixed(FIXED, ZoneOffset.UTC));

        PipelineEvent saved = recorder.recordGlobalEvent(PipelineEventRecord.builder()
                .type("SETTINGS_CHANGED").severity(Severity.INFO).actor(Actor.HUMAN)
                .payload("{\"slotCap\":4}").build());

        PipelineEvent reloaded = events.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPipelineId()).isNull();
        assertThat(reloaded.getTaskId()).isNull();
        assertThat(reloaded.getType()).isEqualTo("SETTINGS_CHANGED");
        assertThat(reloaded.getSeverity()).isEqualTo(Severity.INFO);
        assertThat(reloaded.getActor()).isEqualTo(Actor.HUMAN);
        assertThat(reloaded.getCreatedAt()).isEqualTo(FIXED);
        assertThat(reloaded.getNotifiedAt()).isNull();
    }
}
