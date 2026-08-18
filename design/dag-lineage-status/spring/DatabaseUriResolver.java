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
 * Fills in dag_database_uri.database_uri, OUTSIDE the event path — the
 * subscriber's ack never depends on Pipeline Manager's availability.
 *
 * Names come from the events we already consumed; Pipeline Manager only
 * resolves forward (dagName -> databaseUri) and only one name per call, so
 * knowing the name first is the only way in.
 *
 * The mapping is 1:1 and immutable, so this runs ONCE PER DAG for the lifetime
 * of that DAG — steady state is just newly created DAGs.
 *
 * Timeliness matters even though it is off the read path: a DAG whose name is
 * still unresolved is invisible to the group board (we cannot tell which
 * databaseUri it belongs to yet), so it renders as "never ran" until resolved.
 *
 * So there are two ways in, and the fast one is the normal one:
 *  - {@link #resolveNow} — the subscriber calls this the moment a name is seen
 *    for the first time. Submitting to the pool does not block, so the ack is
 *    not delayed, and the resolve lands in about as long as one upstream call.
 *  - {@link #resolvePending} — the sweep, for names resolveNow never finished:
 *    Pipeline Manager was down, the process died between ack and resolve, or
 *    the DAG existed before this feature shipped. In steady state it finds
 *    nothing, which is why its interval is slow.
 */
@Component
public class DatabaseUriResolver {

    private static final Logger log = LoggerFactory.getLogger(DatabaseUriResolver.class);

    private final DagDatabaseUriRepository repository;
    private final PipelineManagerClient pipelineManager;
    private final ExecutorService pool;
    private final int batchSize;
    private final int maxAttempts;

    public DatabaseUriResolver(
            DagDatabaseUriRepository repository,
            PipelineManagerClient pipelineManager,
            @Value("${lineage.uri-resolve.concurrency:50}") int concurrency,
            @Value("${lineage.uri-resolve.batch-size:2000}") int batchSize,
            @Value("${lineage.uri-resolve.max-attempts:5}") int maxAttempts) {
        this.repository = repository;
        this.pipelineManager = pipelineManager;
        this.pool = Executors.newFixedThreadPool(concurrency);
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
    }

    /**
     * Resolve one just-seen name off the caller's thread. Fire-and-forget on
     * purpose: a failure here is not the subscriber's problem, because the row
     * already exists with a NULL databaseUri and the sweep will retry it.
     */
    public void resolveNow(String dagName) {
        pool.execute(() -> resolveOne(dagName));
    }

    // ponytail: fixed pool of `concurrency` in-flight calls — Pipeline Manager has
    // no bulk endpoint, so 50 single calls at a time is the substitute, and it caps
    // both entry points at once. batchSize caps how much one sweep attempts, which
    // only matters for a backlog: 100k pre-existing names drain in (names /
    // batchSize) cycles. Raise it if the upstream tolerates more.
    @Scheduled(fixedDelayString = "${lineage.uri-resolve.delay:PT5M}")
    public void resolvePending() {
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
                // Pipeline Manager does not know this DAG (yet).
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
     * Adapter for Pipeline Manager. Returns null when the DAG is unknown to it.
     * One name per call and forward only — that constraint is why
     * dag_database_uri exists (see schema.sql).
     */
    public interface PipelineManagerClient {
        String databaseUriOf(String dagName);
    }
}
