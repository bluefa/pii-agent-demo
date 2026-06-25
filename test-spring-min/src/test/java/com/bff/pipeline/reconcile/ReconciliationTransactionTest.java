package com.bff.pipeline.reconcile;

import com.bff.pipeline.config.PipelineSettings;
import com.bff.pipeline.control.PipelineControl;
import com.bff.pipeline.create.PipelineCreator;
import com.bff.pipeline.domain.Pipeline;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.TaskStatus;
import com.bff.pipeline.im.ImClient;
import com.bff.pipeline.im.TerraformPoll;
import com.bff.pipeline.repository.PipelineRepository;
import com.bff.pipeline.repository.TaskRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Real-context (no {@code @DataJpaTest} wrapping tx) proofs that need committed transactions:
 *
 * <ul>
 *   <li>{@link PipelineReconciliation#reconcile} runs through the Spring proxy in its OWN committed transaction —
 *       the change is visible to a fresh repository read with no surrounding test tx (proving fix 2: the tick's
 *       self-invocation was bypassing the proxy before the split).</li>
 *   <li>a {@code cancel()} that commits DURING the (synchronous) IM call does NOT get clobbered — the in-flight
 *       reconcile's stale save is rejected by the {@code Task} optimistic lock and CANCELLED stands (fix 3).</li>
 * </ul>
 *
 * The IM poll is gated by latches so the test can land the cancel commit exactly while the call is in flight.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:rtx;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "pipeline.scheduler.initial-delay-ms=600000" // keep the background tick out of the test
})
class ReconciliationTransactionTest {

    @Autowired private PipelineReconciliation reconciliation;
    @Autowired private PipelineCreator creator;
    @Autowired private PipelineControl control;
    @Autowired private PipelineRepository pipelines;
    @Autowired private TaskRepository tasks;
    @Autowired private GatedImClient im;

    @AfterEach
    void cleanup() {
        im.reset();
        tasks.deleteAll();
        pipelines.deleteAll();
    }

    @Test
    void reconcileCommitsInItsOwnTransactionVisibleToAFreshRead() {
        Pipeline pipeline = creator.create("ts-rtx-1", PipelineType.DELETE);
        im.poll = TerraformPoll.success();

        reconciliation.reconcile(pipeline.getId()); // dispatch (no gate set → returns immediately)

        // No surrounding test transaction — a fresh read sees the committed IN_PROGRESS + stored job_id.
        assertThat(tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()).getFirst().getStatus())
                .isEqualTo(TaskStatus.IN_PROGRESS);

        reconciliation.reconcile(pipeline.getId()); // poll SUCCEEDED → DONE → pipeline DONE (committed)
        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.DONE);
    }

    @Test
    void aCancelThatCommitsDuringTheImCallDoesNotClobberCancelled() throws Exception {
        Pipeline pipeline = creator.create("ts-rtx-2", PipelineType.DELETE);
        reconciliation.reconcile(pipeline.getId()); // → IN_PROGRESS, job-1 stored (committed)

        // The next poll will BLOCK inside the IM call until the test cancels and releases it.
        CountDownLatch callInFlight = new CountDownLatch(1);
        CountDownLatch cancelCommitted = new CountDownLatch(1);
        im.gate(callInFlight, cancelCommitted, TerraformPoll.success());

        Thread reconcileThread = new Thread(() -> {
            try {
                reconciliation.reconcile(pipeline.getId()); // blocks in poll, then tries to save IN_PROGRESS→DONE
            } catch (RuntimeException ignored) {
                // the optimistic-lock failure is expected here — the tick's try/catch swallows it in production
            }
        });
        reconcileThread.start();

        assertThat(callInFlight.await(5, TimeUnit.SECONDS)).isTrue(); // poll is now in flight
        control.cancel(pipeline.getId());                            // commit CANCELLED mid-call
        cancelCommitted.countDown();                                 // let the poll return
        reconcileThread.join(5_000);

        // The reconcile's stale save must NOT have overwritten CANCELLED.
        assertThat(pipelines.findById(pipeline.getId()).orElseThrow().getStatus()).isEqualTo(PipelineStatus.CANCELLED);
        assertThat(tasks.findByPipelineIdOrderBySeqAsc(pipeline.getId()).getFirst().getStatus())
                .isEqualTo(TaskStatus.CANCELLED);
    }

    @TestConfiguration
    static class Wiring {
        @Bean @Primary GatedImClient gatedImClient() {
            return new GatedImClient();
        }

        // A generous per-call timeout so the gated poll is not abandoned as CALL_TIMEOUT before the cancel lands.
        @Bean @Primary PipelineSettings pipelineSettings() {
            return PipelineSettings.defaults().withPerCallTimeout(Duration.ofSeconds(10));
        }
    }

    /** A fake IM whose poll can block on a latch so the test lands a concurrent cancel mid-call. */
    static final class GatedImClient implements ImClient {
        volatile TerraformPoll poll = TerraformPoll.running();
        private volatile CountDownLatch callInFlight;
        private volatile CountDownLatch release;
        private volatile TerraformPoll gatedResult;

        void gate(CountDownLatch callInFlight, CountDownLatch release, TerraformPoll result) {
            this.callInFlight = callInFlight;
            this.release = release;
            this.gatedResult = result;
        }

        void reset() {
            poll = TerraformPoll.running();
            callInFlight = null;
            release = null;
        }

        @Override public String runTerraform(String target, String operation) {
            return "job-1";
        }

        @Override public TerraformPoll terraformJobStatus(String jobId) {
            if (callInFlight != null) {
                callInFlight.countDown();
                try {
                    release.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return gatedResult;
            }
            return poll;
        }

        @Override public boolean checkCondition(String target, String operation) {
            return false;
        }
    }
}
