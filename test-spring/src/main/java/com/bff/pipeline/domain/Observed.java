package com.bff.pipeline.domain;

/**
 * task_check.observed — the raw, kind-specific observation (canonical; no unified verdict is stored).
 * Poll (TERRAFORM_JOB): RUNNING/SUCCEEDED/FAILED. Condition (CONDITION_CHECK): MET/NOT_MET.
 */
public enum Observed {
    RUNNING,
    SUCCEEDED,
    FAILED,
    MET,
    NOT_MET
}
