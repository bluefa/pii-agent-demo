package com.bff.pipeline.handler;

/** Input to a TERRAFORM_JOB poll — the execution unit and the handle from attempt.response. */
public record PollContext(String targetSourceId, String handle) {}
