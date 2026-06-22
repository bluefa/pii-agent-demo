package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.entity.Pipeline;
import com.bff.pipeline.entity.Task;
import lombok.Builder;
import lombok.Getter;

/**
 * One task's slice of a reconciler tick: the owning pipeline, the task being advanced, whether it is due
 * this tick, and the shared per-tick external-call budget. Built by the reconciler and consumed entirely
 * inside the tick's state-transition transaction, so it holds the live JPA entities — it never crosses the
 * fire-and-forget boundary (§3 / D-T4; the launcher captures scalars for that).
 */
@Getter
@Builder
class TaskTick {

    private final Pipeline pipeline;
    private final Task task;
    private final boolean due;
    private final ExternalCallTickBudget budget;
}
