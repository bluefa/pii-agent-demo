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
     * ponytail: DAG list is derived from events, so a DAG with zero events in
     * the window disappears entirely instead of showing 7x NOT_SCHEDULED.
     * Page from a DAG catalog table instead once one exists.
     */
    public List<DagKey> pageDagKeys(OffsetDateTime windowStart, int page, int size) {
        return jdbc.query("""
                SELECT DISTINCT namespace, dag_id
                  FROM dag_run_status
                 WHERE logical_date >= ?
                 ORDER BY namespace, dag_id
                 LIMIT ? OFFSET ?
                """,
                (rs, i) -> new DagKey(rs.getString("namespace"), rs.getString("dag_id")),
                windowStart, size, (long) page * size);
    }

    /**
     * Day-level fold for one page of DAGs.
     * Day bucket = logical_date in KST (not event arrival time).
     * Day precedence: SUCCESS > RUNNING > FAILED (min of the rank).
     */
    public List<DayStatusRow> dayStatuses(List<DagKey> keys, OffsetDateTime windowStart) {
        if (keys.isEmpty()) {
            return List.of();
        }
        String pairs = keys.stream().map(k -> "(?, ?)").collect(Collectors.joining(", "));
        String sql = """
                SELECT namespace, dag_id,
                       (logical_date AT TIME ZONE 'Asia/Seoul')::date AS day,
                       min(CASE status
                             WHEN 'SUCCESS' THEN 1
                             WHEN 'RUNNING' THEN 2
                             WHEN 'FAILED'  THEN 3
                           END) AS state_rank,
                       max(event_time) FILTER (WHERE status = 'SUCCESS') AS success_time
                  FROM dag_run_status
                 WHERE logical_date >= ? AND (namespace, dag_id) IN (%s)
                 GROUP BY namespace, dag_id, day
                """.formatted(pairs);

        List<Object> params = new ArrayList<>();
        params.add(windowStart);
        for (DagKey key : keys) {
            params.add(key.namespace());
            params.add(key.dagId());
        }
        return jdbc.query(sql, (rs, i) -> new DayStatusRow(
                        new DagKey(rs.getString("namespace"), rs.getString("dag_id")),
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
