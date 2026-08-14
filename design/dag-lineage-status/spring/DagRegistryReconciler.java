package com.example.lineage;

import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Resolves dag name -> external id OUTSIDE the event path.
 *
 * The mapping is 1:1 and static, and every DAG runs daily, so after the
 * one-time bulk backfill this loop only fires the id API for genuinely new
 * DAG names. Steady state: ~0 API calls per day. The subscriber's ack path
 * never depends on the id API's availability.
 *
 * The weekly board LEFT JOINs dag_registry, so a brand-new DAG shows a null
 * external id for at most one reconcile interval.
 */
@Component
public class DagRegistryReconciler {

    private static final Logger log = LoggerFactory.getLogger(DagRegistryReconciler.class);

    // ponytail: sized for incremental drift, not for the initial 100k load.
    // Cold-start backfill goes through the bulk endpoint (or a one-off script).
    private static final int BATCH_LIMIT = 1000;

    private final DagRegistryRepository registry;
    private final DagIdClient dagIdClient;

    public DagRegistryReconciler(DagRegistryRepository registry, DagIdClient dagIdClient) {
        this.registry = registry;
        this.dagIdClient = dagIdClient;
    }

    @Scheduled(fixedDelayString = "${lineage.registry.reconcile-delay:PT5M}")
    public void reconcile() {
        List<String> unresolved = registry.unresolvedNames(BATCH_LIMIT);
        for (String dagName : unresolved) {
            Optional<String> id = dagIdClient.idFor(dagName);
            if (id.isPresent()) {
                registry.save(dagName, id.get());
            } else {
                // Name the id API does not know: leave unresolved and retry
                // next cycle. If this persists, the ingest-volume alarm on the
                // pipeline is the place it will surface.
                log.warn("dag id not found for {}", dagName);
            }
        }
    }

    /** Adapter for the existing dag-name -> id API server; implement with the real client. */
    public interface DagIdClient {
        Optional<String> idFor(String dagName);
    }
}
