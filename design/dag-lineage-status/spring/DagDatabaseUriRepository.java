package com.example.lineage;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Reverse map dag name -> databaseUri (see schema.sql).
 *
 * Pipeline Manager resolves names forward, one at a time; a group read needs
 * the opposite direction for a whole page at once. This table is that
 * direction, built from names the event path has already seen.
 */
@Repository
public class DagDatabaseUriRepository {

    private static final RowMapper<DagDatabaseUri> ROW = (rs, i) ->
            new DagDatabaseUri(rs.getString("dag_name"), rs.getString("database_uri"));

    private final JdbcTemplate jdbc;

    public DagDatabaseUriRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Record that this dag name exists, from the event path. Local write only —
     * resolving the name costs an API call and happens later, off the ingest
     * path, so an ack never depends on Pipeline Manager being up.
     */
    public void seen(String dagName) {
        jdbc.update("INSERT IGNORE INTO dag_database_uri (dag_name) VALUES (?)", dagName);
    }

    /** Resolver work queue: seen names with no databaseUri yet, still under the attempt cap. */
    public List<String> pendingNames(int maxAttempts, int limit) {
        return jdbc.queryForList("""
                SELECT dag_name
                  FROM dag_database_uri
                 WHERE database_uri IS NULL
                   AND attempts < ?
                 LIMIT ?
                """, String.class, maxAttempts, limit);
    }

    /** Write-once: the mapping is 1:1 and immutable, so a resolved row is never revisited. */
    public void resolved(String dagName, String databaseUri) {
        jdbc.update("""
                UPDATE dag_database_uri
                   SET database_uri = ?, resolved_at = NOW(6)
                 WHERE dag_name = ?
                """, databaseUri, dagName);
    }

    /** Count the miss so a name Pipeline Manager never answers stops being retried forever. */
    public void resolveFailed(String dagName) {
        jdbc.update("UPDATE dag_database_uri SET attempts = attempts + 1 WHERE dag_name = ?", dagName);
    }

    /**
     * Translate one page of databaseUris (from Infra Manager) back to dag names.
     * Bounded by the page size, so the 10k members of a group never land in one
     * IN list. URIs with no mapped DAG are simply missing from the result —
     * the caller renders them as "never ran".
     */
    public List<DagDatabaseUri> findByDatabaseUris(List<String> databaseUris) {
        if (databaseUris.isEmpty()) {
            return List.of();
        }
        String placeholders = databaseUris.stream().map(u -> "?").collect(Collectors.joining(", "));
        return jdbc.query("""
                SELECT dag_name, database_uri
                  FROM dag_database_uri
                 WHERE database_uri IN (%s)
                """.formatted(placeholders), ROW, databaseUris.toArray());
    }
}
