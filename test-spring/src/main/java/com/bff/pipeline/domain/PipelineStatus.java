package com.bff.pipeline.domain;

/**
 * pipeline.status (5 states). Derived from task states by the reconciler, except the single
 * user-driven transition RUNNING -> CANCELLING (Admin API). terminal = DONE/FAILED/CANCELLED.
 */
public enum PipelineStatus {
    RUNNING,
    CANCELLING,
    DONE,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == DONE || this == FAILED || this == CANCELLED;
    }
}
