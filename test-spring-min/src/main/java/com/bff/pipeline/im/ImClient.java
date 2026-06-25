package com.bff.pipeline.im;

/**
 * The Infra Manager boundary (minimal-redesign.md §3): the orchestrator's external seam. Each task's recipe
 * {@code operation} selects what the call does. Production is HTTP-backed; tests substitute a fake. A call
 * either returns its value or throws — the reconciler treats any throw as a retriable failure (a 429/503 is
 * just a retriable failure here; there is no backpressure cooperation in the minimal design).
 */
public interface ImClient {

    /** TERRAFORM_JOB dispatch — run the {@code operation} terraform for the target; returns the job_id.
     *  Idempotent (O28): a duplicate submit is harmless and re-issues the same logical job. */
    String runTerraform(String target, String operation);

    /** TERRAFORM_JOB poll — read-only job status by handle. */
    TerraformPoll terraformJobStatus(String jobId);

    /** CONDITION_CHECK — read-only condition probe; true once the {@code operation} condition is met. */
    boolean checkCondition(String target, String operation);
}
