package com.bff.pipeline.domain;

/**
 * The task lifecycle (minimal-redesign.md §2). "Blocked by a predecessor" is derived (a higher-seq task is
 * simply not the current one), never a stored state; DISPATCHING is gone (dispatch is synchronous + idempotent);
 * RUNNING and WAITING_EXTERNAL collapse into IN_PROGRESS (the task kind selects the poll logic).
 */
public enum TaskStatus {
    READY,
    IN_PROGRESS,
    DONE,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == DONE || this == FAILED || this == CANCELLED;
    }
}
