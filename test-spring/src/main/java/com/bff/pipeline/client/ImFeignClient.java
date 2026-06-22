package com.bff.pipeline.client;
import com.bff.pipeline.dto.ConditionResponse;
import com.bff.pipeline.dto.TerraformJobStatusResponse;
import com.bff.pipeline.dto.TerraformRunRequest;
import com.bff.pipeline.dto.TerraformRunResponse;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Infra Manager transport (example) — assumed Feign. Task handlers call this; the reconciler never does.
 * The backing HTTP client should be VT-friendly (feign-hc5 / feign-java11) to avoid carrier pinning
 * (implementation-notes §A). Production base URL via {@code im.base-url}.
 *
 * <p>This is a thin transport: 429/503/timeout surface as exceptions, which {@link ImCallMapper}
 * classifies into the backpressure / call-timeout / hard-error distinctions the handlers need.
 */
@FeignClient(name = "infra-manager", url = "${im.base-url:http://infra-manager.local}")
public interface ImFeignClient {

    /** TERRAFORM_JOB dispatch — returns a server-issued job_id. Must be idempotent downstream (O28). */
    @PostMapping("/api/v1/terraform/runs")
    TerraformRunResponse runTerraform(@RequestBody TerraformRunRequest request);

    /** TERRAFORM_JOB poll — read-only job status. */
    @GetMapping("/api/v1/terraform/runs/{jobId}")
    TerraformJobStatusResponse terraformJobStatus(@PathVariable("jobId") String jobId);

    /** CONDITION_CHECK — read-only condition probe (the "general", non-terraform call). */
    @GetMapping("/api/v1/conditions/network-ready")
    ConditionResponse checkNetworkReady(@RequestParam("targetSourceId") String targetSourceId);
}
