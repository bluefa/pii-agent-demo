package com.bff.pipeline.im;

/** IM terraform run request (example). */
public record TerraformRunRequest(String targetSourceId, String operation) {}
