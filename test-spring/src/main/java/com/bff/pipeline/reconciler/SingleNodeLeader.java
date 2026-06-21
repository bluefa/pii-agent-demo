package com.bff.pipeline.reconciler;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Default single-node leader (always leads). Active in every profile EXCEPT {@code postgres}, where
 * {@code PostgresAdvisoryLockLeader} takes over — so exactly one {@link Leader} bean exists in any profile.
 */
@Component
@Profile("!postgres")
public class SingleNodeLeader implements Leader {
    @Override
    public boolean isLeader() {
        return true;
    }
}
