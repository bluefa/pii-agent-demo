package com.bff.pipeline.service.external;

import com.bff.pipeline.client.ImClient;
import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.dto.CallResult;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.entity.TaskAttempt;
import com.bff.pipeline.type.CallStatus;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.util.Backoff;
import com.bff.pipeline.util.ImFaults;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * The call-thread side of the reconciler (Decision 3.1/3.2/6, D-T2). The tick asks this service to run a task's
 * external IM call; the call is FIRED on the fire-and-forget pool ({@code pipelineCallExecutor}) and the
 * dispatch/poll/check method returns immediately — the reconciler loop never blocks on a slow IM call (D-T2
 * 비블로킹 async 발사). On the call thread the call runs under a per-call deadline ({@link #callWithDeadline},
 * D-T3): the work is submitted to an internal virtual-thread pool and bounded by {@code future.get(deadline)},
 * a timeout becoming CALL_TIMEOUT. Its outcome is mapped to one {@link CallResult} (the IM fault →
 * BACKPRESSURE/REJECT mapping is {@link ImFaults}), then the observation ({@code task_check}) and — on dispatch —
 * the adopted response are written in the call-thread transaction ({@link TaskCheckObservationWriter},
 * REQUIRES_NEW). The tick reads that committed observation on a LATER tick to advance task state (D-T4 single
 * writer). This service never writes task status / fail_count / the normal next_check_at; the only schedule
 * write it owns is the backpressure next_check_at.
 *
 * <p>The launcher branches on the call phase (dispatch / poll / check) to pick the {@link ImClient} method,
 * using {@code task.operation}. The scalars that cross the async boundary (taskId, attemptId, name, handle,
 * targetSourceId, operation) are captured before submission so the call thread never touches a JPA entity
 * detached once the tick tx commits.
 */
@Service
public class ExternalCallLauncher {

    private final Executor background;
    private final ExecutorService perCallThreads = Executors.newVirtualThreadPerTaskExecutor();
    private final ImClient im;
    private final TaskCheckObservationWriter observations;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public ExternalCallLauncher(@Qualifier("pipelineCallExecutor") Executor background, ImClient im,
                                TaskCheckObservationWriter observations, PipelineEngineSettings settings, Clock clock) {
        this.background = background;
        this.im = im;
        this.observations = observations;
        this.settings = settings;
        this.clock = clock;
    }

    /** TERRAFORM_JOB dispatch (5-step §3.1): fire async → PENDING pre-record → call → fill + response adoption. */
    public void dispatch(Task task, TaskAttempt attempt, String targetSourceId) {
        long taskId = task.getId();
        long attemptId = attempt.getId();
        String name = task.getOperation() + ":dispatch";
        String operation = task.getOperation();
        background.execute(() -> runDispatch(taskId, attemptId, name, operation, targetSourceId));
    }

    private void runDispatch(long taskId, long attemptId, String name, String operation, String targetSourceId) {
        long checkId = observations.prerecordDispatch(taskId, attemptId, name);
        CallResult result = observe(() -> im.runTerraform(targetSourceId, operation), this::dispatchBackoff);
        observations.completeDispatch(checkId, taskId, attemptId, result);
    }

    /** TERRAFORM_JOB job poll (CHECK, RLE). Reads the job by the adopted handle (attempt.response). */
    public void poll(Task task, TaskAttempt attempt, String targetSourceId) {
        long taskId = task.getId();
        long attemptId = attempt.getId();
        String name = task.getOperation() + ":poll";
        String handle = attempt.getResponse();
        background.execute(() -> {
            CallResult result = observe(() -> im.terraformJobStatus(handle), this::pollBackoff);
            observations.recordPoll(taskId, attemptId, name, handle, result);
        });
    }

    /** CONDITION_CHECK condition check (CHECK, RLE). No handle, no slot, no attempt. */
    public void check(Task task, String targetSourceId) {
        long taskId = task.getId();
        String name = task.getOperation() + ":check";
        String operation = task.getOperation();
        background.execute(() -> {
            CallResult result = observe(
                    () -> conditionValue(im.checkCondition(targetSourceId, operation)), this::checkBackoff);
            observations.recordCheck(taskId, name, result);
        });
    }

    private static String conditionValue(boolean met) {
        return met ? "MET" : "NOT_MET";
    }

    /**
     * Run one IM call under the per-call deadline and finish it into a {@link CallResult}: the call maps to
     * SUCCESS(value) or a thrown IM fault → BACKPRESSURE/REJECT ({@link ImFaults}); the deadline-exceeded case
     * is TIMEOUT/CALL_TIMEOUT. The measured latency rides on the result; a BACKPRESSURE result also defers
     * {@code next_check_at} by the phase-specific backoff floor (carried via the writer's clock).
     */
    private CallResult observe(Supplier<String> imCall, Function<Duration, Duration> backoff) {
        Instant start = clock.instant();
        CallResult call = callWithDeadline(imCall);
        long latencyMs = Duration.between(start, clock.instant()).toMillis();
        return CallResult.builder()
                .status(call.getStatus())
                .value(call.getValue())
                .errorCode(call.getErrorCode())
                .retryAfter(call.getStatus() == CallStatus.BACKPRESSURE ? backoff.apply(call.getRetryAfter()) : null)
                .latencyMs(latencyMs)
                .build();
    }

    /**
     * Bound ONE external call by the per-call deadline (D-T3): submit on the internal virtual-thread pool and
     * wait {@code future.get(deadline)}. A returned value is SUCCESS; a thrown IM fault is classified
     * ({@link ImFaults}); exceeding the deadline cancels the call and reads as TIMEOUT/CALL_TIMEOUT.
     */
    private CallResult callWithDeadline(Supplier<String> imCall) {
        Future<String> future = perCallThreads.submit(imCall::get);
        try {
            String value = future.get(settings.getPerCallDeadline().toMillis(), TimeUnit.MILLISECONDS);
            return CallResult.builder().status(CallStatus.SUCCESS).value(value).build();
        } catch (TimeoutException e) {
            future.cancel(true);
            return CallResult.builder().status(CallStatus.TIMEOUT).errorCode(ErrorCode.CALL_TIMEOUT).build();
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new IllegalStateException("external call interrupted", e);
        } catch (java.util.concurrent.ExecutionException e) {
            return e.getCause() instanceof RuntimeException re
                    ? ImFaults.classify(re)
                    : CallResult.builder().status(CallStatus.REJECT).build();
        }
    }

    /** Dispatch has no cadence floor (it is not a repeating poll); null Retry-After defers to the next tick. */
    private Duration dispatchBackoff(Duration retryAfter) {
        return Backoff.orDefault(retryAfter, settings.getTickInterval());
    }

    private Duration pollBackoff(Duration retryAfter) {
        return Backoff.atLeast(retryAfter, settings.getJobPollCadence());
    }

    private Duration checkBackoff(Duration retryAfter) {
        return Backoff.atLeast(retryAfter, settings.getConditionPollingGuard());
    }
}
