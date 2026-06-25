package com.bff.pipeline.domain;

/**
 * The pipeline lifecycle (minimal-redesign.md §2). Cancel is applied synchronously to the tasks, so there is no
 * intermediate CANCELLING state — a RUNNING pipeline goes straight to a terminal status.
 */
public enum PipelineStatus {
    RUNNING,
    DONE,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == DONE || this == FAILED || this == CANCELLED;
    }
}
