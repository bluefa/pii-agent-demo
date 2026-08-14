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
     * out-of-order delivery (older event -> rejected by the WHERE clause).
     */
    private static final String UPSERT = """
            INSERT INTO dag_run_status
                (run_id, namespace, dag_id, logical_date, run_type, status, event_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (run_id) DO UPDATE
               SET status = EXCLUDED.status,
                   event_time = EXCLUDED.event_time,
                   updated_at = now()
             WHERE EXCLUDED.event_time > dag_run_status.event_time
            """;

    public void upsert(DagRunRow row) {
        jdbc.update(UPSERT, row.runId(), row.namespace(), row.dagId(),
                row.logicalDate(), row.runType(), row.state().name(), row.eventTime());
    }

    /**
     * Day-level aggregate for one page of DAG names. The page comes from
     * dag_registry (the catalog decides WHICH DAGs are listed; this query
     * only fills in their days).
     * Day bucket = logical_date in KST (not event arrival time).
     * Day precedence: SUCCESS > RUNNING > FAILED (min of the rank).
     */
    public List<DayStatusRow> dayStatuses(List<String> dagIds, OffsetDateTime windowStart) {
        if (dagIds.isEmpty()) {
            return List.of();
        }
        String placeholders = dagIds.stream().map(n -> "?").collect(Collectors.joining(", "));
        String sql = """
                SELECT dag_id,
                       max(namespace) AS namespace,
                       (logical_date AT TIME ZONE 'Asia/Seoul')::date AS day,
                       min(CASE status
                             WHEN 'SUCCESS' THEN 1
                             WHEN 'RUNNING' THEN 2
                             WHEN 'FAILED'  THEN 3
                           END) AS state_rank,
                       max(event_time) FILTER (WHERE status = 'SUCCESS') AS success_time
                  FROM dag_run_status
                 WHERE logical_date >= ? AND dag_id IN (%s)
                 GROUP BY dag_id, day
                """.formatted(placeholders);

        List<Object> params = new ArrayList<>();
        params.add(windowStart);
        params.addAll(dagIds);
        // max(namespace): a DAG lives in exactly one environment; max() is
        // just the representative pick the GROUP BY requires.
        return jdbc.query(sql, (rs, i) -> new DayStatusRow(
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
