package com.example.lineage;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Fills in dag_database_uri.database_uri, OUTSIDE the event path — the
 * subscriber's ack never depends on Pipeline Manager's availability.
 *
 * Names come from the events we already consumed; Pipeline Manager only
 * resolves forward (dagName -> databaseUri) and only one name per call, so
 * knowing the name first is the only way in.
 *
 * The mapping is 1:1 and immutable, so this runs ONCE PER DAG for the lifetime
 * of that DAG — steady state is just newly created DAGs.
 */
@Component
public class DatabaseUriResolver {

    private static final Logger log = LoggerFactory.getLogger(DatabaseUriResolver.class);

    private final DagDatabaseUriRepository repository;
    private final PipelineManagerClient pipelineManager;
    private final int batchSize;
    private final int maxAttempts;

    public DatabaseUriResolver(
            DagDatabaseUriRepository repository,
            PipelineManagerClient pipelineManager,
            @Value("${lineage.uri-resolve.batch-size:500}") int batchSize,
            @Value("${lineage.uri-resolve.max-attempts:5}") int maxAttempts) {
        this.repository = repository;
        this.pipelineManager = pipelineManager;
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
    }

    // ponytail: sequential single calls — Pipeline Manager has no bulk endpoint.
    // Cold start is one call per DAG that has ever run (~100k, one-time); if that
    // backfill is too slow, resolve the batch on a small fixed thread pool.
    @Scheduled(fixedDelayString = "${lineage.uri-resolve.delay:PT1M}")
    public void resolvePending() {
        List<String> names = repository.pendingNames(maxAttempts, batchSize);
        int resolved = 0;
        for (String dagName : names) {
            try {
                String databaseUri = pipelineManager.databaseUriOf(dagName);
                if (databaseUri == null) {
                    // Pipeline Manager does not know this DAG (yet).
                    repository.resolveFailed(dagName);
                } else {
                    repository.resolved(dagName, databaseUri);
                    resolved++;
                }
            } catch (Exception e) {
                // Count the miss and move on; the next cycle retries until the cap.
                repository.resolveFailed(dagName);
                log.warn("databaseUri resolve failed for {}: {}", dagName, e.getMessage());
            }
        }
        if (!names.isEmpty()) {
            log.info("databaseUri resolve: {} attempted, {} resolved", names.size(), resolved);
        }
    }

    /**
     * Adapter for Pipeline Manager. Returns null when the DAG is unknown to it.
     * One name per call and forward only — that constraint is why
     * dag_database_uri exists (see schema.sql).
     */
    public interface PipelineManagerClient {
        String databaseUriOf(String dagName);
    }
}
