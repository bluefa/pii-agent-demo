package com.bff.pipeline.reconciler;

import org.springframework.stereotype.Component;

/**
 * Default single-node leader (always leads). The production multi-replica impl would acquire a
 * Postgres advisory lock instead and be wired as the {@link Leader} bean (e.g. @Primary) in its place.
 */
@Component
public class SingleNodeLeader implements Leader {
    @Override
    public boolean isLeader() {
        return true;
    }
}
