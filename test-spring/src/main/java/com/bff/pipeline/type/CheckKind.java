package com.bff.pipeline.type;

/**
 * task_check.kind. DISPATCH = 1 row per dispatch call (no RLE; poll_count=1). CHECK = an
 * observation run that collapses consecutive identical observations (RLE, follow-up 17). Both a
 * TERRAFORM_JOB job-poll and a CONDITION_CHECK condition-check are kind=CHECK.
 */
public enum CheckKind {
    DISPATCH,
    CHECK
}
