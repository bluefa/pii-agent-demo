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
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * The call-thread side of the reconciler (Decision 3.1/3.2/6). The tick asks this service to run a task's
 * external call; the call runs under a per-call deadline ({@link ExternalCallExecutor}), the observation is
 * written to {@code task_check} and (on dispatch) the response is adopted — all in the call-thread
 * transaction ({@link ObservationWriter}, REQUIRES_NEW). The returned outcome lets the tick advance task
 * state in its own transaction; if the call-thread instead crashed, the next tick recovers from the
 * committed observation. This service never writes task status / fail_count / the normal next_check_at.
 */
@Service
public class ExternalCalls {

    private final ExternalCallExecutor executor;
    private final ObservationWriter observations;
    private final RuntimeSettings settings;
    private final Clock clock;

    public ExternalCalls(ExternalCallExecutor executor, ObservationWriter observations,
                         RuntimeSettings settings, Clock clock) {
        this.executor = executor;
        this.observations = observations;
        this.settings = settings;
        this.clock = clock;
    }

    /** TERRAFORM_JOB dispatch (5-step §3.1): PENDING pre-record -> call -> fill + response adoption.
     *  {@code targetSourceId} comes from the owning pipeline (the tick has it; the task row does not). */
    public DispatchOutcome dispatch(Task task, TaskAttempt attempt, TerraformJobHandler handler, String targetSourceId) {
        long checkId = observations.prerecordDispatch(task.getId(), operation(handler, "dispatch"));
        CallOutcome<DispatchOutcome> call = executor.call(
                () -> handler.dispatch(new DispatchContext(targetSourceId)), settings.getPerCallDeadline());
        DispatchOutcome outcome = call.timedOut() ? new DispatchOutcome.CallTimeout() : call.value();

        Instant backpressureAt = outcome instanceof DispatchOutcome.Backpressure b
                ? clock.instant().plus(dispatchBackoff(b.retryAfter())) : null;
        observations.completeDispatch(checkId, task.getId(), attempt.getId(), outcome, call.latencyMs(), backpressureAt);
        return outcome;
    }

    /** TERRAFORM_JOB job poll (CHECK, RLE). Reads the job by the adopted handle (attempt.response). */
    public PollOutcome poll(Task task, TaskAttempt attempt, TerraformJobHandler handler, String targetSourceId) {
        String handle = attempt.getResponse();
        CallOutcome<PollOutcome> call = executor.call(
                () -> handler.poll(new PollContext(targetSourceId, handle)), settings.getPerCallDeadline());
        PollOutcome outcome = call.timedOut() ? new PollOutcome.CallFailed(ErrorCode.CALL_TIMEOUT) : call.value();

        Instant backpressureAt = outcome instanceof PollOutcome.Backpressure b
                ? clock.instant().plus(pollBackoff(b.retryAfter())) : null;
        observations.recordCheckObservation(
                task.getId(), operation(handler, "poll"), handle, classify(outcome), call.latencyMs(), backpressureAt);
        return outcome;
    }

    /** CONDITION_CHECK condition check (CHECK, RLE). No handle, no slot, no attempt. */
    public CheckOutcome check(Task task, ConditionCheckHandler handler, String targetSourceId) {
        CallOutcome<CheckOutcome> call = executor.call(
                () -> handler.check(new CheckContext(targetSourceId)), settings.getPerCallDeadline());
        CheckOutcome outcome = call.timedOut() ? new CheckOutcome.CallFailed(ErrorCode.CALL_TIMEOUT) : call.value();

        Instant backpressureAt = outcome instanceof CheckOutcome.Backpressure b
                ? clock.instant().plus(checkBackoff(b.retryAfter())) : null;
        observations.recordCheckObservation(
                task.getId(), operation(handler, "check"), null, classify(outcome), call.latencyMs(), backpressureAt);
        return outcome;
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
