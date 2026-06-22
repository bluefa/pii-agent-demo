package com.bff.pipeline.client;

import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * The test seam replacing the former fake handlers: a settable {@link ImClient} the test scripts per call.
 * Each operation returns a canned value, or throws a simulated IM fault that the launcher classifies — a
 * non-429/503 Feign error → REJECT (IM_REJECTED / CHECK_ERROR), a 429/503 → BACKPRESSURE. A per-call deadline
 * TIMEOUT is driven by a behavior that blocks past the launcher's perCallDeadline (the launcher owns the
 * deadline now). Stateless stub: the scripted behavior is set before each fired call runs, so a queued call
 * observes the behavior current at drain time (faithful to one call per drain).
 */
public final class FakeImClient implements ImClient {

    /** Scripted behavior for one IM call: return a value, or throw a classified fault. */
    @FunctionalInterface
    public interface Behavior {
        String run();
    }

    private Behavior runTerraform = () -> "job-9";
    private Behavior terraformJobStatus = () -> "RUNNING";
    private Behavior checkCondition = () -> "NOT_MET";

    public void setRunTerraform(Behavior behavior) {
        this.runTerraform = behavior;
    }

    public void setTerraformJobStatus(Behavior behavior) {
        this.terraformJobStatus = behavior;
    }

    public void setCheckCondition(Behavior behavior) {
        this.checkCondition = behavior;
    }

    /** dispatch returns this job_id. */
    public void dispatchAccepted(String jobId) {
        this.runTerraform = () -> jobId;
    }

    /** dispatch / poll / check hard-rejects (non-backpressure) → REJECT. */
    public static Behavior reject() {
        return () -> { throw httpError(500, null); };
    }

    /** dispatch / poll / check backpressures (429/503) with an optional Retry-After (seconds). */
    public static Behavior backpressure(Long retryAfterSeconds) {
        return () -> { throw httpError(503, retryAfterSeconds); };
    }

    /** poll observed a terminal/non-terminal job status (RUNNING / SUCCEEDED / FAILED). */
    public static Behavior jobStatus(String status) {
        return () -> status;
    }

    /** check observed the condition (true = MET, false = NOT_MET). */
    public static Behavior condition(boolean met) {
        return () -> met ? "MET" : "NOT_MET";
    }

    @Override
    public String runTerraform(String targetSourceId, String operation) {
        return runTerraform.run();
    }

    @Override
    public String terraformJobStatus(String jobId) {
        return terraformJobStatus.run();
    }

    @Override
    public boolean checkCondition(String targetSourceId, String operation) {
        return "MET".equals(checkCondition.run());
    }

    private static FeignException httpError(int status, Long retryAfterSeconds) {
        Request request = Request.create(Request.HttpMethod.GET, "http://im.local",
                Map.of(), Request.Body.empty(), new RequestTemplate());
        Map<String, java.util.Collection<String>> headers = retryAfterSeconds == null
                ? Map.of()
                : Map.of("Retry-After", java.util.List.of(String.valueOf(retryAfterSeconds)));
        return FeignException.errorStatus("imCall",
                feign.Response.builder()
                        .status(status)
                        .reason("simulated")
                        .request(request)
                        .headers(headers)
                        .body(new byte[0])
                        .build());
    }
}
