package com.example.lineage;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * DAG catalog: name -> external id (1:1, names globally unique across
 * environments). This table is the source of truth for WHICH DAGs the weekly
 * board lists — a DAG with zero events still shows as 7x NOT_SCHEDULED.
 */
@Repository
public class DagRegistryRepository {

    private final JdbcTemplate jdbc;

    public DagRegistryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Keyset page ordered by dag_name; pass the previous page's last name (null for the first page). */
    public List<DagCatalogEntry> page(String afterDagName, int limit) {
        return jdbc.query("""
                SELECT dag_name, external_id
                  FROM dag_registry
                 WHERE dag_name > ?
                 ORDER BY dag_name
                 LIMIT ?
                """,
                (rs, i) -> new DagCatalogEntry(rs.getString("dag_name"), rs.getString("external_id")),
                afterDagName == null ? "" : afterDagName, limit);
    }

    /** Bulk upsert from a catalog sync; touching synced_at marks the row as still alive. */
    public void saveAll(List<DagCatalogEntry> entries) {
        jdbc.batchUpdate("""
                INSERT INTO dag_registry (dag_name, external_id)
                VALUES (?, ?) AS new
                ON DUPLICATE KEY UPDATE
                    external_id = new.external_id,
                    synced_at = NOW(6)
                """,
                entries, 1000, (ps, entry) -> {
                    ps.setString(1, entry.dagName());
                    ps.setString(2, entry.externalId());
                });
    }

    /** Remove DAGs the source catalog no longer returns (deleted DAGs). */
    public int deleteNotSyncedSince(OffsetDateTime syncStart) {
        return jdbc.update("DELETE FROM dag_registry WHERE synced_at < ?", syncStart);
    }

    /** DB clock, so the liveness cutoff is immune to app/DB clock skew. */
    public OffsetDateTime dbNow() {
        return jdbc.queryForObject("SELECT NOW(6)", OffsetDateTime.class);
    }
}
