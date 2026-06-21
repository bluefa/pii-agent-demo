package com.bff.pipeline.reconciler;

/**
 * Leader election (Decision 1, NFR-4). Only the pod holding the lock runs the tick; the rest skip.
 * State-machine correctness does NOT depend on this (every transition is guarded) — it is an efficiency
 * device. Production uses a Postgres session-scoped advisory lock (pg_try_advisory_lock); a lost lock
 * auto-releases and another pod takes over (failover <= one tick).
 */
public interface Leader {
    boolean isLeader();
}
