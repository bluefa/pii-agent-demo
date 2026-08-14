package com.example.lineage;

import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps dag_registry in sync with the dag-id API, OUTSIDE the event path —
 * the subscriber's ack never depends on the id API's availability.
 *
 * The registry doubles as the board's DAG catalog, so this sync also decides
 * which DAGs are listed: rows absent from the fetched catalog are deleted
 * (removed DAGs leave the board), and a brand-new DAG appears after at most
 * one sync interval.
 *
 * Cold start: run one sync() as the initial backfill before exposing the board.
 */
@Component
public class DagCatalogSync {

    private static final Logger log = LoggerFactory.getLogger(DagCatalogSync.class);

    private final DagRegistryRepository registry;
    private final DagCatalogClient catalogClient;

    public DagCatalogSync(DagRegistryRepository registry, DagCatalogClient catalogClient) {
        this.registry = registry;
        this.catalogClient = catalogClient;
    }

    // ponytail: hourly full sync of ~100k name->id pairs (~5MB per fetch).
    // Tighten the interval if new DAGs must appear on the board sooner.
    @Scheduled(fixedDelayString = "${lineage.catalog.sync-delay:PT1H}")
    public void sync() {
        OffsetDateTime syncStart = registry.dbNow();
        List<DagCatalogEntry> catalog = catalogClient.fetchAll();
        if (catalog.isEmpty()) {
            // An empty or failed fetch must not wipe the catalog.
            log.warn("dag catalog fetch returned nothing; keeping current registry");
            return;
        }
        registry.saveAll(catalog);
        int removed = registry.deleteNotSyncedSince(syncStart);
        log.info("dag catalog synced: {} rows, {} removed", catalog.size(), removed);
    }

    /**
     * Adapter for the dag-name -> id API server; implement with the real
     * client. If the API has no bulk/list endpoint, a paged fetch loop goes
     * here (open issue #5 in architecture.md).
     */
    public interface DagCatalogClient {
        List<DagCatalogEntry> fetchAll();
    }
}
