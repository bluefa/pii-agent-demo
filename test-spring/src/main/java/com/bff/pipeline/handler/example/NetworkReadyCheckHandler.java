package com.bff.pipeline.handler.example;

import com.bff.pipeline.domain.ErrorCode;
import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.handler.*;
import com.bff.pipeline.im.ImCallMapper;
import com.bff.pipeline.im.ImFault;
import com.bff.pipeline.im.ImFeignClient;
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
    public CheckOutcome check(CheckContext ctx) {
        try {
            boolean met = im.checkNetworkReady(ctx.targetSourceId()).met();
            return new CheckOutcome.Condition(met ? Observed.MET : Observed.NOT_MET);
        } catch (RuntimeException e) {
            return switch (faults.classify(e)) {
                case ImFault.Backpressure bp -> new CheckOutcome.Backpressure(bp.retryAfter());
                case ImFault.Timeout ignored -> new CheckOutcome.CallFailed(ErrorCode.CALL_TIMEOUT);
                case ImFault.HardError ignored -> new CheckOutcome.CallFailed(ErrorCode.CHECK_ERROR);
            };
        }
    }
}
