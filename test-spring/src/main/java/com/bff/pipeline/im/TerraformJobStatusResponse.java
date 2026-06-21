package com.bff.pipeline.im;

/** IM terraform job status — status in {RUNNING, SUCCEEDED, FAILED}. */
public record TerraformJobStatusResponse(String status) {}
