package com.bff.pipeline.service.reconciler;

/**
 * The per-tick poll/check fire budget (Decision 1.3 / D-T7: {@code maxExternalCallsPerTick}). Dispatch is
 * NOT counted here — it is gated by slotCap admission instead. Mutable, single-threaded within one tick.
 */
final class ExternalCallTickBudget {

    private int remaining;

    ExternalCallTickBudget(int remaining) {
        this.remaining = remaining;
    }

    /** Consume one poll/check fire; false when the tick's budget is spent (the task waits for the next tick). */
    boolean tryConsume() {
        if (remaining <= 0) {
            return false;
        }
        remaining--;
        return true;
    }
}
