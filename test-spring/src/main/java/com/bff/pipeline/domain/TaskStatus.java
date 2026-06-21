package com.bff.pipeline.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * task.status (9 states). Non-terminal: BLOCKED, READY, DISPATCHING, RUNNING, WAITING_EXTERNAL.
 * terminal: DONE, FAILED, EXPIRED, CANCELLED. The slot-queue wait is NOT a separate state — it is
 * {@code READY && kind==TERRAFORM_JOB} (WAITING_SLOT removed, S26).
 */
public enum TaskStatus {
    BLOCKED,
    READY,
    DISPATCHING,
    RUNNING,
    WAITING_EXTERNAL,
    DONE,
    FAILED,
    EXPIRED,
    CANCELLED;

    private static final Set<TaskStatus> TERMINAL = EnumSet.of(DONE, FAILED, EXPIRED, CANCELLED);

    /** DISPATCHING|RUNNING occupy a TERRAFORM_JOB slot (admission COUNT). */
    private static final Set<TaskStatus> SLOT_OCCUPYING = EnumSet.of(DISPATCHING, RUNNING);

    public boolean isTerminal() {
        return TERMINAL.contains(this);
    }

    public boolean occupiesSlot() {
        return SLOT_OCCUPYING.contains(this);
    }
}
