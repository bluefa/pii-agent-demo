package com.bff.pipeline.type;

/**
 * The 4-way result of one external IM call (dispatch / poll / check) — the load-bearing distinction the
 * reconciler's non-accrual and retry paths depend on (Decision 3 / §3 fail_count rules):
 * <ul>
 *   <li>{@code SUCCESS} — the call returned a value (dispatch job_id, or the poll/check observed value).</li>
 *   <li>{@code BACKPRESSURE} — 429/503; NOT a failure (fail_count not consumed; same logical attempt).</li>
 *   <li>{@code REJECT} — a hard (non-backpressure) error → IM_REJECTED (dispatch) / CHECK_ERROR (poll/check).</li>
 *   <li>{@code TIMEOUT} — the single call exceeded its per-call deadline → CALL_TIMEOUT.</li>
 * </ul>
 */
public enum CallStatus {
    SUCCESS,
    BACKPRESSURE,
    REJECT,
    TIMEOUT
}
