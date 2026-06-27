package com.bff.pipeline.domain;

/**
 * What a task does (minimal-redesign.md §2). A TERRAFORM_JOB runs a TF job and polls its status to terminal; a
 * CONDITION_CHECK polls a probe until a condition is met. The kind selects the IN_PROGRESS poll logic.
 */
public enum TaskKind {
    TERRAFORM_JOB,
    CONDITION_CHECK
}
