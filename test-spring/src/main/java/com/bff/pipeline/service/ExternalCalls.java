package com.bff.pipeline.service;

import com.bff.pipeline.ops.RuntimeSettings;
import com.bff.pipeline.domain.ApiResult;
import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Task;
import com.bff.pipeline.domain.TaskAttempt;
import com.bff.pipeline.handler.CheckContext;
import com.bff.pipeline.handler.CheckOutcome;
import com.bff.pipeline.handler.ConditionCheckHandler;
import com.bff.pipeline.handler.DispatchContext;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.handler.PipelineHandler;
import com.bff.pipeline.handler.PollContext;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executor;

/**
 * The call-thread side of the reconciler (Decision 3.1/3.2/6, D-T2). The tick asks this service to run a
 * task's external call; the call is FIRED on the fire-and-forget pool ({@code pipelineCallExecutor}) and this
 * method returns immediately — the reconciler loop never blocks on a slow IM call (D-T2 비블로킹 async 발사).
 * On the call thread the call runs under a per-call deadline ({@link ExternalCallExecutor}), then the
 * observation ({@code task_check}) and — on dispatch — the adopted response are written in the call-thread
 * transaction ({@link ObservationWriter}, REQUIRES_NEW). The tick reads that committed observation on a LATER
 * tick to advance task state (D-T4 single writer). This service never writes task status / fail_count / the
 * normal next_check_at; the only schedule write it owns is the backpressure next_check_at.
 *
 * <p>Scalars (ids, handle, target, operation name) are captured before submission so the call thread never
 * touches a JPA entity that is detached once the tick transaction commits.
 */
@Service
public class ExternalCalls {

    private final Executor background;
    private final ExternalCallExecutor executor;
    private final ObservationWriter observations;
    private final RuntimeSettings settings;
    private final Clock clock;

    public ExternalCalls(@Qualifier("pipelineCallExecutor") Executor background, ExternalCallExecutor executor,
                         ObservationWriter observations, RuntimeSettings settings, Clock clock) {
        this.background = background;
        this.executor = executor;
        this.observations = observations;
        this.settings = settings;
        this.clock = clock;
    }

    /** TERRAFORM_JOB dispatch (5-step §3.1): fire async → PENDING pre-record → call → fill + response adoption.
     *  {@code targetSourceId} comes from the owning pipeline (the tick has it; the task row does not). */
    public void dispatch(Task task, TaskAttempt attempt, TerraformJobHandler handler, String targetSourceId) {
        long taskId = task.getId();
        long attemptId = attempt.getId();
        String name = operation(handler, "dispatch");
        background.execute(() -> runDispatch(taskId, attemptId, handler, targetSourceId, name));
    }

    private void runDispatch(long taskId, long attemptId, TerraformJobHandler handler, String targetSourceId, String name) {
        long checkId = observations.prerecordDispatch(taskId, attemptId, name);
        CallOutcome<DispatchOutcome> call = executor.call(
                () -> handler.dispatch(new DispatchContext(targetSourceId)), settings.getPerCallDeadline());
        DispatchOutcome outcome = call.timedOut() ? new DispatchOutcome.CallTimeout() : call.value();

        Instant backpressureAt = outcome instanceof DispatchOutcome.Backpressure b
                ? clock.instant().plus(dispatchBackoff(b.retryAfter())) : null;
        observations.completeDispatch(checkId, taskId, attemptId, outcome, call.latencyMs(), backpressureAt);
    }

    /** TERRAFORM_JOB job poll (CHECK, RLE). Reads the job by the adopted handle (attempt.response). */
    public void poll(Task task, TaskAttempt attempt, TerraformJobHandler handler, String targetSourceId) {
        long taskId = task.getId();
        long attemptId = attempt.getId();
        String handle = attempt.getResponse();
        String name = operation(handler, "poll");
        background.execute(() -> runPoll(taskId, attemptId, handle, handler, targetSourceId, name));
    }

    private void runPoll(long taskId, long attemptId, String handle, TerraformJobHandler handler, String targetSourceId, String name) {
        CallOutcome<PollOutcome> call = executor.call(
                () -> handler.poll(new PollContext(targetSourceId, handle)), settings.getPerCallDeadline());
        PollOutcome outcome = call.timedOut() ? new PollOutcome.CallFailed(ErrorCode.CALL_TIMEOUT) : call.value();

        Instant backpressureAt = outcome instanceof PollOutcome.Backpressure b
                ? clock.instant().plus(pollBackoff(b.retryAfter())) : null;
        observations.recordCheckObservation(taskId, attemptId, name, handle, classify(outcome), call.latencyMs(), backpressureAt);
    }

    /** CONDITION_CHECK condition check (CHECK, RLE). No handle, no slot, no attempt. */
    public void check(Task task, ConditionCheckHandler handler, String targetSourceId) {
        long taskId = task.getId();
        String name = operation(handler, "check");
        background.execute(() -> runCheck(taskId, handler, targetSourceId, name));
    }

    private void runCheck(long taskId, ConditionCheckHandler handler, String targetSourceId, String name) {
        CallOutcome<CheckOutcome> call = executor.call(
                () -> handler.check(new CheckContext(targetSourceId)), settings.getPerCallDeadline());
        CheckOutcome outcome = call.timedOut() ? new CheckOutcome.CallFailed(ErrorCode.CALL_TIMEOUT) : call.value();

        Instant backpressureAt = outcome instanceof CheckOutcome.Backpressure b
                ? clock.instant().plus(checkBackoff(b.retryAfter())) : null;
        // CONDITION_CHECK has no attempt → attemptId null (the MET/EXPIRED read is unscoped — no re-attempt).
        observations.recordCheckObservation(taskId, null, name, null, classify(outcome), call.latencyMs(), backpressureAt);
    }

    private static Observation classify(PollOutcome outcome) {
        return switch (outcome) {
            case PollOutcome.Status s -> new Observation(ApiResult.OK, s.observed(), null);
            case PollOutcome.Backpressure ignored -> new Observation(ApiResult.ERROR, null, null);
            case PollOutcome.CallFailed f -> new Observation(ApiResult.ERROR, null, f.reason());
        };
    }

    private static Observation classify(CheckOutcome outcome) {
        return switch (outcome) {
            case CheckOutcome.Condition c -> new Observation(ApiResult.OK, c.observed(), null);
            case CheckOutcome.Backpressure ignored -> new Observation(ApiResult.ERROR, null, null);
            case CheckOutcome.CallFailed f -> new Observation(ApiResult.ERROR, null, f.reason());
        };
    }

    /** Dispatch has no cadence floor (it is not a repeating poll); null Retry-After defers to the next tick. */
    private Duration dispatchBackoff(Duration retryAfter) {
        return retryAfter != null ? retryAfter : settings.getTickInterval();
    }

    private Duration pollBackoff(Duration retryAfter) {
        return atLeast(retryAfter, settings.getJobPollCadence());
    }

    private Duration checkBackoff(Duration retryAfter) {
        return atLeast(retryAfter, settings.getConditionPollingGuard());
    }

    private static Duration atLeast(Duration retryAfter, Duration floor) {
        return retryAfter != null && retryAfter.compareTo(floor) > 0 ? retryAfter : floor;
    }

    private static String operation(PipelineHandler handler, String verb) {
        return handler.key() + ":" + verb;
    }
}
