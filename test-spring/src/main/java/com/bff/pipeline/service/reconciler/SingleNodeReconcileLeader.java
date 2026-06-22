package com.bff.pipeline.service.reconciler;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Default single-node leader (always leads). Active in every profile EXCEPT {@code postgres}, where
 * {@code PostgresAdvisoryLockReconcileLeader} takes over — so exactly one {@link ReconcileLeader} bean exists in any profile.
 */
@Component
@Profile("!postgres")
public class SingleNodeReconcileLeader implements ReconcileLeader {
    @Override
    public boolean isLeader() {
        return true;
    }
}
