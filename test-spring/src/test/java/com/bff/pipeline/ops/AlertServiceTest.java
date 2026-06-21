package com.bff.pipeline.ops;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.AttemptResult;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.Severity;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskAttempt;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.repo.PipelineEventRepository;
import com.bff.pipeline.repo.PipelineRepository;
import com.bff.pipeline.repo.TaskAttemptRepository;
import com.bff.pipeline.repo.TaskRepository;
import com.bff.pipeline.service.EventRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link AlertService} — in-app operational alerts (operations §알림). Each check is a single rollup: it emits
 * one {@code pipeline_event} when the condition holds and suppresses a duplicate while a same-type alert is
 * already live in the window. With the {@link Clock} fixed and the default {@link PipelineSettings} windows
 * (executionTimeout 30m, queueWaitAlert 30m), the seeded timestamps place rows inside or outside the window
 * deterministically.
 */
@DataJpaTest
@Import({AlertService.class, EventRecorder.class, AlertServiceTest.Wiring.class})
class AlertServiceTest {

    private static final Instant FIXED = Instant.parse("2026-06-21T10:15:30Z");

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
    private AlertService alerts;
    @Autowired
    private TaskAttemptRepository attempts;
    @Autowired
    private TaskRepository tasks;
    @Autowired
    private PipelineRepository pipelines;
    @Autowired
    private PipelineEventRepository events;

    @Test
    void workerOutageEmitsOneCriticalAlertWhenTimeoutsReachThresholdThenDedupes() {
        timeoutAttempt(101L);
        timeoutAttempt(102L);
        timeoutAttempt(103L);

        alerts.checkWorkerOutage();
        alerts.checkWorkerOutage();

        List<PipelineEvent> outages = eventsOfType("WORKER_OUTAGE_SUSPECTED");
        assertThat(outages).hasSize(1);
        PipelineEvent outage = outages.getFirst();
        assertThat(outage.getSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(outage.getActor()).isEqualTo(Actor.SYSTEM);
        assertThat(outage.getPipelineId()).isNull();
        assertThat(outage.getTaskId()).isNull();
    }

    @Test
    void workerOutageEmitsNothingBelowThreshold() {
        timeoutAttempt(201L);
        timeoutAttempt(202L);

        alerts.checkWorkerOutage();

        assertThat(eventsOfType("WORKER_OUTAGE_SUSPECTED")).isEmpty();
    }

    @Test
    void queueWaitEmitsAlertWhenSlotQueuedTaskOwningPipelineStartedBeforeThreshold() {
        Pipeline stalled = runningPipeline(FIXED.minus(Duration.ofMinutes(40)));
        slotQueuedTask(stalled.getId());

        alerts.checkQueueWait();

        List<PipelineEvent> queueWaits = eventsOfType("QUEUE_WAIT_EXCEEDED");
        assertThat(queueWaits).hasSize(1);
        assertThat(queueWaits.getFirst().getActor()).isEqualTo(Actor.SYSTEM);
        assertThat(queueWaits.getFirst().getPipelineId()).isNull();
    }

    @Test
    void queueWaitEmitsNothingWhenOwningPipelineStartedWithinThreshold() {
        Pipeline fresh = runningPipeline(FIXED);
        slotQueuedTask(fresh.getId());

        alerts.checkQueueWait();

        assertThat(eventsOfType("QUEUE_WAIT_EXCEEDED")).isEmpty();
    }

    private void timeoutAttempt(long taskId) {
        TaskAttempt attempt = new TaskAttempt();
        attempt.setTaskId(taskId);
        attempt.setAttemptNo(1);
        attempt.setStartedAt(FIXED.minus(Duration.ofMinutes(5)));
        attempt.setFinishedAt(FIXED);
        attempt.setResult(AttemptResult.FAIL);
        attempt.setErrorCode(ErrorCode.EXECUTION_TIMEOUT);
        attempts.save(attempt);
    }

    private Pipeline runningPipeline(Instant startedAt) {
        Pipeline pipeline = new Pipeline();
        pipeline.setTargetSourceId("ts-alert-" + startedAt.toEpochMilli());
        pipeline.setType(PipelineType.INSTALL);
        pipeline.setProvider("AWS");
        pipeline.setStatus(PipelineStatus.RUNNING);
        pipeline.setTriggeredBy(Actor.HUMAN);
        pipeline.setCreatedAt(startedAt);
        pipeline.setStartedAt(startedAt);
        pipeline.setLastActivityAt(startedAt);
        return pipelines.save(pipeline);
    }

    private void slotQueuedTask(long pipelineId) {
        Task task = new Task();
        task.setPipelineId(pipelineId);
        task.setSeq(0);
        task.setName("network");
        task.setHandlerKey("aws.tf.network");
        task.setKind(TaskKind.TERRAFORM_JOB);
        task.setStatus(TaskStatus.READY);
        task.setFailCount(0);
        task.setMaxFailCount(3);
        tasks.save(task);
    }

    private List<PipelineEvent> eventsOfType(String type) {
        return events.findAll().stream().filter(e -> e.getType().equals(type)).toList();
    }
}
