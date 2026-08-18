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
 * direction, mirrored from Pipeline Manager's full dag name roster.
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
     * Take in Pipeline Manager's full dag name roster. IGNORE keeps names we
     * already resolved untouched, so a sync only ever adds — and what it adds
     * is exactly the DAGs created since the last one.
     *
     * Deletions are deliberately not mirrored: a dropped DAG's row points at a
     * databaseUri Infra Manager no longer returns, so it can never reach the
     * screen. Reaping it would be work with no observable effect.
     */
    public void seenAll(List<String> dagNames) {
        jdbc.batchUpdate("INSERT IGNORE INTO dag_database_uri (dag_name) VALUES (?)",
                dagNames.stream().map(name -> new Object[] {name}).toList());
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
