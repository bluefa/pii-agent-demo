package com.bff.pipeline.service.external;
import com.bff.pipeline.dto.ExternalCallOutcome;
import com.bff.pipeline.dto.CheckObservationRecord;
import com.bff.pipeline.dto.ConditionCheckCommand;
import com.bff.pipeline.dto.DispatchCompletion;
import com.bff.pipeline.dto.TaskCheckObservation;
import com.bff.pipeline.dto.TerraformJobCall;
import com.bff.pipeline.dto.TerraformJobCallCommand;

import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.type.ApiResult;
import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.entity.Task;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;
import com.bff.pipeline.service.handler.ConditionCheckHandler;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.service.handler.PipelineHandler;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;
import com.bff.pipeline.service.handler.TerraformJobHandler;
import lombok.NonNull;
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
 * transaction ({@link TaskCheckObservationWriter}, REQUIRES_NEW). The tick reads that committed observation on a LATER
 * tick to advance task state (D-T4 single writer). This service never writes task status / fail_count / the
 * normal next_check_at; the only schedule write it owns is the backpressure next_check_at.
 *
 * <p>Scalars (ids, handle, target, operation name) are captured before submission so the call thread never
 * touches a JPA entity that is detached once the tick transaction commits.
 */
@Service
public class ExternalCallLauncher {

    private final Executor background;
    private final ExternalCallExecutor executor;
    private final TaskCheckObservationWriter observations;
    private final PipelineEngineSettings settings;
    private final Clock clock;

    public ExternalCallLauncher(@Qualifier("pipelineCallExecutor") Executor background, ExternalCallExecutor executor,
                         TaskCheckObservationWriter observations, PipelineEngineSettings settings, Clock clock) {
        this.background = background;
        this.executor = executor;
        this.observations = observations;
        this.settings = settings;
        this.clock = clock;
    }

    /** TERRAFORM_JOB dispatch (5-step §3.1): fire async → PENDING pre-record → call → fill + response adoption.
     *  {@code targetSourceId} comes from the owning pipeline (the tick has it; the task row does not). */
    public void dispatch(@NonNull TerraformJobCall call) {
        TerraformJobCallCommand command = TerraformJobCallCommand.builder()
                .taskId(call.getTask().getId())
                .attemptId(call.getAttempt().getId())
                .handler(call.getHandler())
                .targetSourceId(call.getTargetSourceId())
                .name(operation(call.getHandler(), "dispatch"))
                .build();
        background.execute(() -> runDispatch(command));
    }

    private void runDispatch(TerraformJobCallCommand command) {
        long checkId = observations.prerecordDispatch(command.getTaskId(), command.getAttemptId(), command.getName());
        ExternalCallOutcome<TerraformDispatchOutcome> call = executor.call(
                () -> command.getHandler().dispatch(TerraformDispatchContext.builder().targetSourceId(command.getTargetSourceId()).build()),
                settings.getPerCallDeadline());
        TerraformDispatchOutcome outcome = call.isTimedOut() ? new TerraformDispatchOutcome.CallTimeout() : call.getValue();

        Instant backpressureAt = outcome instanceof TerraformDispatchOutcome.Backpressure b
                ? clock.instant().plus(dispatchBackoff(b.getRetryAfter())) : null;
        observations.completeDispatch(DispatchCompletion.builder()
                .checkId(checkId)
                .taskId(command.getTaskId())
                .attemptId(command.getAttemptId())
                .outcome(outcome)
                .latencyMs(call.getLatencyMs())
                .backpressureNextCheckAt(backpressureAt)
                .build());
    }

    /** TERRAFORM_JOB job poll (CHECK, RLE). Reads the job by the adopted handle (attempt.response). */
    public void poll(@NonNull TerraformJobCall call) {
        TerraformJobCallCommand command = TerraformJobCallCommand.builder()
                .taskId(call.getTask().getId())
                .attemptId(call.getAttempt().getId())
                .handle(call.getAttempt().getResponse())
                .handler(call.getHandler())
                .targetSourceId(call.getTargetSourceId())
                .name(operation(call.getHandler(), "poll"))
                .build();
        background.execute(() -> runPoll(command));
    }

    private void runPoll(TerraformJobCallCommand command) {
        ExternalCallOutcome<TerraformPollOutcome> call = executor.call(
                () -> command.getHandler().poll(
                        TerraformPollContext.builder().targetSourceId(command.getTargetSourceId()).handle(command.getHandle()).build()),
                settings.getPerCallDeadline());
        TerraformPollOutcome outcome = call.isTimedOut()
                ? TerraformPollOutcome.CallFailed.builder().reason(ErrorCode.CALL_TIMEOUT).build() : call.getValue();

        Instant backpressureAt = outcome instanceof TerraformPollOutcome.Backpressure b
                ? clock.instant().plus(pollBackoff(b.getRetryAfter())) : null;
        observations.recordCheckObservation(CheckObservationRecord.builder()
                .taskId(command.getTaskId())
                .attemptId(command.getAttemptId())
                .name(command.getName())
                .handle(command.getHandle())
                .observation(classify(outcome))
                .latencyMs(call.getLatencyMs())
                .backpressureNextCheckAt(backpressureAt)
                .build());
    }

    /** CONDITION_CHECK condition check (CHECK, RLE). No handle, no slot, no attempt. */
    public void check(@NonNull Task task, @NonNull ConditionCheckHandler handler, @NonNull String targetSourceId) {
        ConditionCheckCommand command = ConditionCheckCommand.builder()
                .taskId(task.getId())
                .handler(handler)
                .targetSourceId(targetSourceId)
                .name(operation(handler, "check"))
                .build();
        background.execute(() -> runCheck(command));
    }

    private void runCheck(ConditionCheckCommand command) {
        ExternalCallOutcome<ConditionCheckOutcome> call = executor.call(
                () -> command.getHandler().check(ConditionCheckContext.builder().targetSourceId(command.getTargetSourceId()).build()),
                settings.getPerCallDeadline());
        ConditionCheckOutcome outcome = call.isTimedOut()
                ? ConditionCheckOutcome.CallFailed.builder().reason(ErrorCode.CALL_TIMEOUT).build() : call.getValue();

        Instant backpressureAt = outcome instanceof ConditionCheckOutcome.Backpressure b
                ? clock.instant().plus(checkBackoff(b.getRetryAfter())) : null;
        // CONDITION_CHECK has no attempt → attemptId null (the MET/EXPIRED read is unscoped — no re-attempt).
        observations.recordCheckObservation(CheckObservationRecord.builder()
                .taskId(command.getTaskId())
                .name(command.getName())
                .observation(classify(outcome))
                .latencyMs(call.getLatencyMs())
                .backpressureNextCheckAt(backpressureAt)
                .build());
    }

    private static TaskCheckObservation classify(TerraformPollOutcome outcome) {
        return switch (outcome) {
            case TerraformPollOutcome.Status s -> TaskCheckObservation.builder().apiResult(ApiResult.OK).observed(s.getObserved()).build();
            case TerraformPollOutcome.Backpressure ignored -> TaskCheckObservation.builder().apiResult(ApiResult.ERROR).build();
            case TerraformPollOutcome.CallFailed f -> TaskCheckObservation.builder().apiResult(ApiResult.ERROR).errorCode(f.getReason()).build();
        };
    }

    private static TaskCheckObservation classify(ConditionCheckOutcome outcome) {
        return switch (outcome) {
            case ConditionCheckOutcome.Condition c -> TaskCheckObservation.builder().apiResult(ApiResult.OK).observed(c.getObserved()).build();
            case ConditionCheckOutcome.Backpressure ignored -> TaskCheckObservation.builder().apiResult(ApiResult.ERROR).build();
            case ConditionCheckOutcome.CallFailed f -> TaskCheckObservation.builder().apiResult(ApiResult.ERROR).errorCode(f.getReason()).build();
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
