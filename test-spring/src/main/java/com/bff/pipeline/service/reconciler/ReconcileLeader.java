package com.bff.pipeline.service.reconciler;

import org.springframework.stereotype.Component;

/**
 * Reconcile-leader election (Decision 1, NFR-4). Only the pod holding leadership runs the tick; the rest skip.
 * State-machine correctness does NOT depend on this — every transition is a guarded CAS and every side effect
 * is idempotent, so the lock is only an efficiency device (a misfire wastes duplicate calls and no-op CAS
 * writes, not state). This single-node default always leads.
 *
 * <p>A multi-replica deployment overrides {@link #isLeader()} with a DB advisory lock so exactly one pod ticks,
 * e.g. a session-scoped Postgres lock held on a dedicated connection for its lifetime:
 * <pre>{@code  select pg_try_advisory_lock(:tickLockKey)  }</pre>
 * A lost lock auto-releases and another pod takes over (failover ≤ one tick). Postgres-only
 * ({@code pg_try_advisory_lock} does not exist on H2), so the override is profile-gated in production; the
 * single-node default here remains the test/dev bean.
 */
@Component
public class ReconcileLeader {

    /** True when this pod should run the tick. The single-node default always leads. */
    public boolean isLeader() {
        return true;
    }
}
