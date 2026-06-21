package com.bff.pipeline.handler.example;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.handler.*;
import com.bff.pipeline.im.ImCallMapper;
import com.bff.pipeline.im.ImFault;
import com.bff.pipeline.im.ImFeignClient;
import com.bff.pipeline.im.TerraformRunRequest;
import org.springframework.stereotype.Component;

/**
 * Example TERRAFORM_JOB handler (tf job) — applies AWS network terraform via the IM Feign client.
 * dispatch() must be idempotent downstream (the IM/terraform apply is; "already-applied" = success).
 */
@Component
public class AwsTfNetworkHandler implements TerraformJobHandler {

    private static final String OPERATION = "apply-network";

    private final ImFeignClient im;
    private final ImCallMapper faults;

    public AwsTfNetworkHandler(ImFeignClient im, ImCallMapper faults) {
        this.im = im;
        this.faults = faults;
    }

    @Override
    public String key() {
        return "aws.tf.network";
    }

    @Override
    public DispatchOutcome dispatch(DispatchContext ctx) {
        try {
            String jobId = im.runTerraform(new TerraformRunRequest(ctx.targetSourceId(), OPERATION)).jobId();
            return new DispatchOutcome.Accepted(jobId);
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> new DispatchOutcome.Backpressure(bp.retryAfter());
                case ImFault.Timeout ignored -> new DispatchOutcome.CallTimeout();
                case ImFault.HardError h -> new DispatchOutcome.Rejected(h.detail());
            };
        }
    }

    @Override
    public PollOutcome poll(PollContext ctx) {
        try {
            return new PollOutcome.Status(mapStatus(im.terraformJobStatus(ctx.handle()).status()));
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> new PollOutcome.Backpressure(bp.retryAfter());
                case ImFault.Timeout ignored -> new PollOutcome.CallFailed(ErrorCode.CALL_TIMEOUT);
                case ImFault.HardError ignored -> new PollOutcome.CallFailed(ErrorCode.CHECK_ERROR);
            };
        }
    }

    private static Observed mapStatus(String status) {
        return switch (status) {
            case "SUCCEEDED" -> Observed.SUCCEEDED;
            case "FAILED" -> Observed.FAILED;
            default -> Observed.RUNNING;
        };
    }
}
