package com.example.lineage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DagRunStatusRepository {

    private final JdbcTemplate jdbc;

    public DagRunStatusRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Idempotent fold: one row per run, newest eventTime wins.
     * Absorbs at-least-once duplicates (same eventTime -> no-op) and
     * out-of-order delivery (older event -> rejected by the IF guards).
     *
     * MySQL has no row-level condition like Postgres' ON CONFLICT ... WHERE,
     * so every column carries its own IF guard. Assignments apply left to
     * right and later ones see earlier results — event_time (the guard's
     * reference) MUST stay last. `VALUES ... AS new` needs MySQL 8.0.19+.
     */
    private static final String UPSERT = """
            INSERT INTO dag_run_status
                (run_id, namespace, dag_id, database_uri, logical_date, run_type, status, event_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS new
            ON DUPLICATE KEY UPDATE
                status     = IF(new.event_time > event_time, new.status, status),
                updated_at = IF(new.event_time > event_time, NOW(6), updated_at),
                event_time = IF(new.event_time > event_time, new.event_time, event_time)
            """;

    // database_uri is absent from the UPDATE list on purpose, like namespace and
    // dag_id: it identifies the run, so the START and terminal events of one run
    // always agree on it. A differing value would be a different run.
    public void upsert(DagRunRow row) {
        jdbc.update(UPSERT, row.runId(), row.namespace(), row.dagId(), row.databaseUri(),
                row.logicalDate(), row.runType(), row.state().name(), row.eventTime());
    }

    /**
     * Day-level aggregate for one page of databaseUris. Infra Manager decides
     * WHICH logical DBs are listed; this query only fills in their days.
     * Day bucket = logical_date in KST (not event arrival time).
     * Day precedence: SUCCESS > RUNNING > FAILED (min of the rank).
     */
    public List<DayStatusRow> dayStatuses(List<String> databaseUris, OffsetDateTime windowStart) {
        if (databaseUris.isEmpty()) {
            return List.of();
        }
        String placeholders = databaseUris.stream().map(n -> "?").collect(Collectors.joining(", "));
        // Fixed +09:00 offset: KST has no DST, so CONVERT_TZ works without
        // the mysql tz tables being loaded. logical_date is stored as UTC.
        String sql = """
                SELECT database_uri,
                       MAX(dag_id)    AS dag_id,
                       MAX(namespace) AS namespace,
                       DATE(CONVERT_TZ(logical_date, '+00:00', '+09:00')) AS day,
                       MIN(CASE status
                             WHEN 'SUCCESS' THEN 1
                             WHEN 'RUNNING' THEN 2
                             WHEN 'FAILED'  THEN 3
                           END) AS state_rank,
                       MAX(CASE WHEN status = 'SUCCESS' THEN event_time END) AS success_time
                  FROM dag_run_status
                 WHERE logical_date >= ? AND database_uri IN (%s)
                 GROUP BY database_uri, day
                """.formatted(placeholders);

        List<Object> params = new ArrayList<>();
        params.add(windowStart);
        params.addAll(databaseUris);
        // max(dag_id) / max(namespace): one logical DB is processed by one DAG in
        // one environment, so both are constant within a group — max() is just the
        // representative pick the GROUP BY requires. If a logical DB ever gets a
        // second DAG, this silently shows one of them; see architecture.md.
        return jdbc.query(sql, (rs, i) -> new DayStatusRow(
                        rs.getString("database_uri"),
                        rs.getString("dag_id"),
                        rs.getString("namespace"),
                        rs.getObject("day", LocalDate.class),
                        rankToState(rs.getInt("state_rank")),
                        rs.getObject("success_time", OffsetDateTime.class)),
                params.toArray());
    }

    private static DayState rankToState(int rank) {
        return switch (rank) {
            case 1 -> DayState.SUCCESS;
            case 2 -> DayState.RUNNING;
            case 3 -> DayState.FAILED;
            default -> throw new IllegalStateException("unexpected state rank " + rank);
        };
    }
}
