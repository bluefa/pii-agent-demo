package com.bff.pipeline.type;

/**
 * The catalog of {@code pipeline_event.type} values (Decision 1.3 outbox). Each constant carries its exact
 * wire string ({@link #wire()}) — the value stored on the row and matched by the notifier's rollup dedupe
 * ({@code existsByType}) and the query filter. The wire form is the API/audit contract, so the literals are
 * preserved verbatim (the {@code PIPELINE_CREATED} underscore vs the {@code PIPELINE:…}/{@code TASK:…} colon
 * forms are intentional, not normalized here).
 */
public enum PipelineEventType {

    // ---- creation / control (pipeline-level) ----
    PIPELINE_CREATED("PIPELINE_CREATED"),
    PIPELINE_CANCELLING("PIPELINE:CANCELLING"),
    PIPELINE_RETRY_ATTEMPTED("PIPELINE:RETRY_ATTEMPTED"),

    // ---- pipeline convergence (derivation) ----
    PIPELINE_CANCELLED("PIPELINE:CANCELLED"),
    PIPELINE_DONE("PIPELINE:DONE"),
    PIPELINE_FAILED("PIPELINE:FAILED"),

    // ---- task transitions ----
    TASK_READY("TASK:READY"),
    TASK_DISPATCHING("TASK:DISPATCHING"),
    TASK_WAITING_EXTERNAL("TASK:WAITING_EXTERNAL"),
    TASK_RUNNING("TASK:RUNNING"),
    TASK_DONE("TASK:DONE"),
    TASK_EXPIRED("TASK:EXPIRED"),
    TASK_FAILED("TASK:FAILED"),
    TASK_REDISPATCH("TASK:REDISPATCH"),
    TASK_REQUEUE("TASK:REQUEUE"),
    TASK_CANCELLED("TASK:CANCELLED"),

    // ---- operational alerts (global) ----
    WORKER_OUTAGE_SUSPECTED("WORKER_OUTAGE_SUSPECTED"),
    QUEUE_WAIT_EXCEEDED("QUEUE_WAIT_EXCEEDED");

    private final String wire;

    PipelineEventType(String wire) {
        this.wire = wire;
    }

    /** the exact {@code pipeline_event.type} string stored on the row and matched by query/dedupe. */
    public String wire() {
        return wire;
    }
}
