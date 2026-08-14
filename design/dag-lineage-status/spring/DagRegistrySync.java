package com.example.lineage;

import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps dag_registry in sync with the DAG list API, OUTSIDE the event path —
 * the subscriber's ack never depends on that API's availability.
 *
 * The registry IS the board's list of DAGs, so this sync also decides which
 * DAGs are shown: rows absent from the fetched list are deleted (removed DAGs
 * leave the board), and a brand-new DAG appears after at most one sync
 * interval.
 *
 * Cold start: run one sync() as the initial backfill before exposing the board.
 */
@Component
public class DagRegistrySync {

    private static final Logger log = LoggerFactory.getLogger(DagRegistrySync.class);

    private final DagRegistryRepository registry;
    private final DagListClient listClient;

    public DagRegistrySync(DagRegistryRepository registry, DagListClient listClient) {
        this.registry = registry;
        this.listClient = listClient;
    }

    // ponytail: hourly full sync of ~100k name->id pairs (~5MB per fetch).
    // Tighten the interval if new DAGs must appear on the board sooner.
    @Scheduled(fixedDelayString = "${lineage.registry.sync-delay:PT1H}")
    public void sync() {
        OffsetDateTime syncStart = registry.dbNow();
        List<DagRegistryEntry> dags = listClient.fetchAll();
        if (dags.isEmpty()) {
            // An empty or failed fetch must not wipe the registry.
            log.warn("dag list fetch returned nothing; keeping current registry");
            return;
        }
        registry.saveAll(dags);
        int removed = registry.deleteNotSyncedSince(syncStart);
        log.info("dag registry synced: {} rows, {} removed", dags.size(), removed);
    }

    /**
     * Adapter for the dag-name -> logical-database API; implement with the real
     * client. If the API has no bulk/list endpoint, a paged fetch loop goes
     * here (open issue #5 in architecture.md).
     */
    public interface DagListClient {
        List<DagRegistryEntry> fetchAll();
    }
}
