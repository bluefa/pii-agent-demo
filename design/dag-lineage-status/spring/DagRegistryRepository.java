package com.example.lineage;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** dag name -> external id mapping (1:1, static). */
@Repository
public class DagRegistryRepository {

    private final JdbcTemplate jdbc;

    public DagRegistryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Names seen in events but not yet resolved to an external id. */
    public List<String> unresolvedNames(int limit) {
        return jdbc.queryForList("""
                SELECT DISTINCT s.dag_id
                  FROM dag_run_status s
                  LEFT JOIN dag_registry r ON r.dag_name = s.dag_id
                 WHERE r.dag_name IS NULL
                 LIMIT ?
                """, String.class, limit);
    }

    public void save(String dagName, String externalId) {
        jdbc.update("""
                INSERT INTO dag_registry (dag_name, external_id)
                VALUES (?, ?)
                ON CONFLICT (dag_name) DO NOTHING
                """, dagName, externalId);
    }

    public Map<String, String> externalIds(Collection<String> dagNames) {
        if (dagNames.isEmpty()) {
            return Map.of();
        }
        String placeholders = dagNames.stream().map(n -> "?").collect(Collectors.joining(", "));
        Map<String, String> result = new HashMap<>();
        jdbc.query("SELECT dag_name, external_id FROM dag_registry WHERE dag_name IN (%s)"
                        .formatted(placeholders),
                rs -> { result.put(rs.getString("dag_name"), rs.getString("external_id")); },
                dagNames.toArray());
        return result;
    }
}
