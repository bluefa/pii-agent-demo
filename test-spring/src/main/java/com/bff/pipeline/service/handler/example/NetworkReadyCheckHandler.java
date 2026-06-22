package com.bff.pipeline.service.handler.example;

import com.bff.pipeline.type.ErrorCode;
import com.bff.pipeline.type.Observed;
import com.bff.pipeline.service.handler.ConditionCheckHandler;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;
import com.bff.pipeline.client.ImCallMapper;
import com.bff.pipeline.exception.ImFault;
import com.bff.pipeline.client.ImFeignClient;
import org.springframework.stereotype.Component;

/**
 * Example CONDITION_CHECK handler (the "general", non-terraform job) — probes a network-ready condition
 * via the IM Feign client until MET. No dispatch, no slot; "not yet" (NOT_MET) is not a failure.
 */
@Component
public class NetworkReadyCheckHandler implements ConditionCheckHandler {

    private final ImFeignClient im;
    private final ImCallMapper faults;

    public NetworkReadyCheckHandler(ImFeignClient im, ImCallMapper faults) {
        this.im = im;
        this.faults = faults;
    }

    @Override
    public String key() {
        return "aws.cond.network-ready";
    }

    @Override
    public ConditionCheckOutcome check(ConditionCheckContext ctx) {
        try {
            boolean met = im.checkNetworkReady(ctx.getTargetSourceId()).isMet();
            return ConditionCheckOutcome.Condition.builder().observed(met ? Observed.MET : Observed.NOT_MET).build();
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> ConditionCheckOutcome.Backpressure.builder().retryAfter(bp.getRetryAfter()).build();
                case ImFault.Timeout ignored -> ConditionCheckOutcome.CallFailed.builder().reason(ErrorCode.CALL_TIMEOUT).build();
                case ImFault.HardError ignored -> ConditionCheckOutcome.CallFailed.builder().reason(ErrorCode.CHECK_ERROR).build();
            };
        }
    }
}
