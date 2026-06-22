package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.service.reconciler.ReconcileLeader;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Multi-replica leader election example (Decision 1.3): only the pod holding the DB advisory lock runs the
 * reconciler tick. Postgres-only ({@code pg_try_advisory_lock} does not exist on H2), so it is gated behind
 * the {@code postgres} profile and is NOT the default bean — {@code SingleNodeReconcileLeader} (returns true) remains
 * the default/test ReconcileLeader. No H2 test for that reason.
 *
 * <p>Correctness does not depend on this lock: every transition is a CAS and every side effect is idempotent,
 * so the lock is only an efficiency device (a misfire wastes duplicate calls and no-op CAS writes, not state).
 * A production impl must hold the lock on a dedicated session/connection for its lifetime; this example shows
 * the mechanism only.
 */
@Component
@Profile("postgres")
public class PostgresAdvisoryLockReconcileLeader implements ReconcileLeader {

    /** A fixed key identifying the reconciler-tick lock (arbitrary constant, shared by all replicas). */
    private static final long TICK_LOCK_KEY = 0xAD016L;

    private final EntityManager entityManager;

    PostgresAdvisoryLockReconcileLeader(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public boolean isLeader() {
        return (Boolean) entityManager.createNativeQuery("select pg_try_advisory_lock(:key)")
                .setParameter("key", TICK_LOCK_KEY)
                .getSingleResult();
    }
}
