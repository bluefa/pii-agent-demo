package com.example.lineage;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mirrors Pipeline Manager's dag name -> databaseUri map into dag_database_uri.
 *
 * Two upstream calls, in this order:
 *  1) the full dag name roster, one call — this is what makes the mirror
 *     COMPLETE, and completeness is the whole point. A databaseUri missing from
 *     a complete map genuinely has no DAG, so the board can state "never
 *     scheduled" as a fact. Built from events instead, the map would only ever
 *     cover DAGs that happened to run, and every gap would be indistinguishable
 *     from a DAG whose events never reached us.
 *  2) databaseUri per unresolved name — forward only and one name per call
 *     (owner-confirmed), so 50 of them run at a time.
 *
 * Ingest is not involved. The subscriber records runs and nothing else.
 *
 * Steady state is cheap: the mapping is 1:1 and immutable, so step 2 runs ONCE
 * PER DAG for that DAG's lifetime, and a cycle that finds no new names costs
 * one roster call.
 */
@Component
public class DagDatabaseUriSync {

    private static final Logger log = LoggerFactory.getLogger(DagDatabaseUriSync.class);

    private final DagDatabaseUriRepository repository;
    private final PipelineManagerClient pipelineManager;
    private final ExecutorService pool;
    private final int batchSize;
    private final int maxAttempts;

    public DagDatabaseUriSync(
            DagDatabaseUriRepository repository,
            PipelineManagerClient pipelineManager,
            @Value("${lineage.uri-sync.concurrency:50}") int concurrency,
            @Value("${lineage.uri-sync.batch-size:2000}") int batchSize,
            @Value("${lineage.uri-sync.max-attempts:5}") int maxAttempts) {
        this.repository = repository;
        this.pipelineManager = pipelineManager;
        this.pool = Executors.newFixedThreadPool(concurrency);
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
    }

    // ponytail: the interval is also the staleness window — a DAG created since
    // the last cycle is absent from the map, and its logical DB renders as "never
    // scheduled" until the next one. Harmless for a DAG that has not run yet;
    // shorten the interval rather than adding an event-triggered fast path, which
    // would put ingest back in the business of owning names.
    @Scheduled(fixedDelayString = "${lineage.uri-sync.delay:PT1H}")
    public void sync() {
        repository.seenAll(pipelineManager.allDagNames());
        resolvePending();
    }

    // ponytail: fixed pool of `concurrency` in-flight calls — Pipeline Manager has
    // no bulk resolve, so 50 single calls at a time is the substitute. batchSize
    // caps one cycle, which only bites on the first sync: the whole roster is
    // unresolved then, and drains over (roster / batchSize) cycles.
    private void resolvePending() {
        List<String> names = repository.pendingNames(maxAttempts, batchSize);
        if (names.isEmpty()) {
            return;
        }
        long resolved = names.stream()
                .map(name -> CompletableFuture.supplyAsync(() -> resolveOne(name), pool))
                .toList()  // start every call before joining any of them
                .stream()
                .filter(CompletableFuture::join)
                .count();
        log.info("databaseUri resolve: {} attempted, {} resolved", names.size(), resolved);
    }

    private boolean resolveOne(String dagName) {
        try {
            String databaseUri = pipelineManager.databaseUriOf(dagName);
            if (databaseUri == null) {
                // In the roster but with no databaseUri — a DAG that is not a
                // logical-DB pipeline at all, or one still being set up.
                repository.resolveFailed(dagName);
                return false;
            }
            repository.resolved(dagName, databaseUri);
            return true;
        } catch (Exception e) {
            // Count the miss and move on; the next cycle retries until the cap.
            repository.resolveFailed(dagName);
            log.warn("databaseUri resolve failed for {}: {}", dagName, e.getMessage());
            return false;
        }
    }

    @PreDestroy
    void shutdown() {
        pool.shutdown();
    }

    /**
     * Adapter for Pipeline Manager.
     *
     * If the roster call can carry each name's databaseUri with it, say so:
     * {@link #databaseUriOf} and everything that schedules it then delete, and
     * one call per cycle replaces one call per DAG.
     */
    public interface PipelineManagerClient {

        /** Every dag name Pipeline Manager knows, in one response. */
        List<String> allDagNames();

        /** Returns null when the DAG has no databaseUri. */
        String databaseUriOf(String dagName);
    }
}
