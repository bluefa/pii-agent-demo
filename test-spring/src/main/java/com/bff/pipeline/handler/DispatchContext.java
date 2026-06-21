package com.bff.pipeline.handler;

/** Input to a TERRAFORM_JOB dispatch — the execution unit only (Decision 2). */
public record DispatchContext(String targetSourceId) {}
