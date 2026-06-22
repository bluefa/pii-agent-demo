package com.bff.pipeline.client;
import com.bff.pipeline.dto.TerraformRunRequest;

import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Production {@link ImClient}: maps the operation-based seam onto the {@link ImFeignClient} transport. Thin —
 * it just shapes requests/responses; the IM fault (429/503/timeout/hard error) propagates as a thrown Feign
 * exception, which {@link com.bff.pipeline.service.external.ExternalCallLauncher} classifies (the HTTP-fault
 * mapping was folded into the launcher). The backing HTTP client should be VT-friendly (feign-hc5 /
 * feign-java11) to avoid carrier pinning. Tests substitute a fake {@link ImClient}, so this is never exercised
 * under @DataJpaTest.
 */
@Component
public class FeignImClient implements ImClient {

    private final ImFeignClient im;

    public FeignImClient(ImFeignClient im) {
        this.im = im;
    }

    @Override
    public String runTerraform(String targetSourceId, String operation) {
        String jobId = im.runTerraform(TerraformRunRequest.builder()
                .targetSourceId(targetSourceId).operation(operation).build()).getJobId();
        return Objects.requireNonNull(jobId, "IM returned null jobId");
    }

    @Override
    public String terraformJobStatus(String jobId) {
        String status = im.terraformJobStatus(jobId).getStatus();
        return Objects.requireNonNull(status, "IM returned null job status");
    }

    @Override
    public boolean checkCondition(String targetSourceId, String operation) {
        return im.checkNetworkReady(targetSourceId).isMet();
    }
}
