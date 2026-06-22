package com.bff.pipeline.type;

/**
 * TaskKind (Decision 2) — flow shape. Two kinds in v1; slot consumption is decided by the kind.
 * <ul>
 *   <li>{@code TERRAFORM_JOB} — dispatch -> job_id -> poll -> terminal. Consumes an IM slot. Has attempts.</li>
 *   <li>{@code CONDITION_CHECK} — no dispatch; polls a condition until MET. No attempt, no slot.</li>
 * </ul>
 */
public enum TaskKind {
    TERRAFORM_JOB,
    CONDITION_CHECK;

    /** Only TERRAFORM_JOB dispatches (side-effect) and therefore consumes a slot. */
    public boolean consumesSlot() {
        return this == TERRAFORM_JOB;
    }
}
