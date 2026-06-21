package com.bff.pipeline.handler;

/** Input to a CONDITION_CHECK — the execution unit only. */
public record CheckContext(String targetSourceId) {}
