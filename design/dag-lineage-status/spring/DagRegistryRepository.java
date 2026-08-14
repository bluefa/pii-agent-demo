package com.example.lineage;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * DAG catalog: name -> external id (1:1, names globally unique across
 * environments), plus the group axis (target_source_id — see schema.sql).
 * This table is the source of truth for WHICH DAGs the weekly board lists —
 * a DAG with zero events still shows as 7x NOT_SCHEDULED.
 */
@Repository
public class DagRegistryRepository {

    private static final RowMapper<DagCatalogEntry> CATALOG_ROW = (rs, i) -> new DagCatalogEntry(
            rs.getString("dag_name"), rs.getString("external_id"),
            rs.getObject("target_source_id", Long.class));

    private final JdbcTemplate jdbc;

    public DagRegistryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Keyset page ordered by dag_name; pass the previous page's last name (null for the first page). */
    public List<DagCatalogEntry> page(String afterDagName, int limit) {
        return jdbc.query("""
                SELECT dag_name, external_id, target_source_id
                  FROM dag_registry
                 WHERE dag_name > ?
                 ORDER BY dag_name
                 LIMIT ?
                """,
                CATALOG_ROW, afterDagName == null ? "" : afterDagName, limit);
    }

    /**
     * Keyset page WITHIN one group (target source). Uses the
     * (target_source_id, dag_name) index, so a request costs one page —
     * never "load all N member ids, then query each" — regardless of N.
     */
    public List<DagCatalogEntry> pageByGroup(long targetSourceId, String afterDagName, int limit) {
        return jdbc.query("""
                SELECT dag_name, external_id, target_source_id
                  FROM dag_registry
                 WHERE target_source_id = ?
                   AND dag_name > ?
                 ORDER BY dag_name
                 LIMIT ?
                """,
                CATALOG_ROW, targetSourceId, afterDagName == null ? "" : afterDagName, limit);
    }

    /**
     * Learn group membership at read time — a group GET is the ONLY moment
     * target_source_id is knowable (owner-confirmed: never at publish,
     * consume, or catalog-sync time). Write-once via the IS NULL guard:
     * membership is immutable, so a learned fact never expires and
     * re-sending the same list is a no-op.
     */
    public void assignGroup(long targetSourceId, List<String> dagNames) {
        jdbc.batchUpdate("""
                UPDATE dag_registry
                   SET target_source_id = ?
                 WHERE dag_name = ?
                   AND target_source_id IS NULL
                """,
                dagNames, 1000, (ps, name) -> {
                    ps.setLong(1, targetSourceId);
                    ps.setString(2, name);
                });
    }

    /**
     * Bulk upsert from a catalog sync; touching synced_at marks the row as
     * still alive. Deliberately never touches target_source_id — the sync
     * source cannot know it (see assignGroup).
     */
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
