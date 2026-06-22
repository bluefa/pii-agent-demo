package com.bff.pipeline.service.handler.example;

import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.service.handler.TerraformJobHandler;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;
import com.bff.pipeline.client.ImCallMapper;
import com.bff.pipeline.exception.ImFault;
import com.bff.pipeline.client.ImFeignClient;
import com.bff.pipeline.dto.TerraformRunRequest;
import org.springframework.stereotype.Component;

import java.util.Objects;

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
    public TerraformDispatchOutcome dispatch(TerraformDispatchContext ctx) {
        try {
            String jobId = im.runTerraform(TerraformRunRequest.builder()
                    .targetSourceId(ctx.getTargetSourceId()).operation(OPERATION).build()).getJobId();
            Objects.requireNonNull(jobId, "IM returned null jobId");
            return TerraformDispatchOutcome.Accepted.builder().handle(jobId).build();
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> TerraformDispatchOutcome.Backpressure.builder().retryAfter(bp.getRetryAfter()).build();
                case ImFault.Timeout ignored -> new TerraformDispatchOutcome.CallTimeout();
                case ImFault.HardError h -> TerraformDispatchOutcome.Rejected.builder().detail(h.getDetail()).build();
            };
        }
    }

    @Override
    public TerraformPollOutcome poll(TerraformPollContext ctx) {
        try {
            String status = im.terraformJobStatus(ctx.getHandle()).getStatus();
            Objects.requireNonNull(status, "IM returned null job status");
            return TerraformPollOutcome.Status.builder().observed(mapStatus(status)).build();
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> TerraformPollOutcome.Backpressure.builder().retryAfter(bp.getRetryAfter()).build();
                case ImFault.Timeout ignored -> TerraformPollOutcome.CallFailed.builder().reason(ErrorCode.CALL_TIMEOUT).build();
                case ImFault.HardError ignored -> TerraformPollOutcome.CallFailed.builder().reason(ErrorCode.CHECK_ERROR).build();
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
