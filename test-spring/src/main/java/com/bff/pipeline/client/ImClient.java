package com.bff.pipeline.client;

/**
 * The Infra Manager boundary (Decision 2) — the orchestrator's external IM seam. Operation-based: each task's
 * recipe {@code operation} string selects what the call does; the reconciler never calls this directly (the
 * call-thread launcher does, under a per-call deadline). Production is Feign-backed ({@link FeignImClient});
 * tests substitute a fake that returns canned job_ids/statuses/results and simulated faults.
 *
 * <p>Semantics preserved from the former handler contract: {@link #runTerraform} is idempotent downstream
 * (O28 — duplicate submits harmless, "already in desired state" = success) and returns a server-issued
 * job_id; {@link #terraformJobStatus} is a read-only status read; {@link #checkCondition} is a read-only
 * condition probe. An IM fault (429/503/timeout/hard error) surfaces as a thrown exception, which the launcher
 * classifies into the backpressure / reject / timeout distinctions.
 */
public interface ImClient {

    /** TERRAFORM_JOB dispatch — run the {@code operation} terraform for the target; returns the job_id. */
    String runTerraform(String targetSourceId, String operation);

    /** TERRAFORM_JOB poll — read-only job status in {RUNNING, SUCCEEDED, FAILED}. */
    String terraformJobStatus(String jobId);

    /** CONDITION_CHECK — read-only condition probe; true once the {@code operation} condition is MET. */
    boolean checkCondition(String targetSourceId, String operation);
}
