-- One row per DagRun, folded from OpenLineage DAG-level events.
-- Raw events are kept nowhere — there is no retention requirement; rows
-- older than the 7-day board window are deleted by a daily batch.
--
-- MySQL 8.0 (the operational DB). Conventions:
--  * DATETIME(6) stores UTC; the app connects with connectionTimeZone=UTC
--    so OffsetDateTime round-trips without shifting.
--  * utf8mb4_bin collation — Airflow dag_ids are case-sensitive, so "Foo"
--    and "foo" must not collide on the PK, and keyset order stays bytewise.
--  * CHECK is enforced from MySQL 8.0.16 (silently ignored before).
CREATE TABLE dag_run_status (
    run_id       VARCHAR(36)  PRIMARY KEY,   -- OpenLineage runId (UUID): same for START and terminal events of one run
    namespace    VARCHAR(250) NOT NULL,      -- Composer environment (AIRFLOW__OPENLINEAGE__NAMESPACE)
    dag_id       VARCHAR(250) NOT NULL,      -- Airflow caps dag_id at 250 chars
    logical_date DATETIME(6)  NOT NULL,      -- day-bucket key; deliberately NOT the event arrival time
    run_type     VARCHAR(50),                -- scheduled | manual | ...
    status       VARCHAR(10)  NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    event_time   DATETIME(6)  NOT NULL,      -- eventTime of the last folded event; guards out-of-order updates
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- Weekly window scan and the 7-day retention delete (WHERE logical_date < ?)
CREATE INDEX idx_dag_run_status_window ON dag_run_status (logical_date);

-- Day-status lookup for one page of DAGs (dag names are globally unique)
CREATE INDEX idx_dag_run_status_dag ON dag_run_status (dag_id, logical_date);

-- DAG catalog: name -> logical database (1:1; names globally unique across
-- environments — owner-confirmed). Source of truth for WHICH DAGs the weekly
-- board lists. Filled by the initial backfill, then kept in sync with the
-- catalog API by DagCatalogSync; the event path never calls that API, so
-- ingest never waits on it and a burst never propagates to it.
CREATE TABLE dag_registry (
    dag_name            VARCHAR(250) PRIMARY KEY,
    logical_database_id VARCHAR(100) NOT NULL UNIQUE,  -- size TBD against the real id format
    -- Group axis: one logical DB per target source, one DAG per logical DB,
    -- so a DAG belongs to at most ONE target source — a column, not a join
    -- table. Unknowable before a group GET arrives (owner-confirmed: not at
    -- publish, consume, or catalog-sync time), so it is learned lazily from
    -- the first GET for the group and write-once after that (membership
    -- never changes) — see assignGroup's IS NULL guard.
    target_source_id    BIGINT,
    synced_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)  -- liveness marker: rows a full sync did not touch get deleted
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- Group board: keyset pagination WITHIN one target source (up to ~10k DAGs
-- per group). Per-request cost is bounded by the page size, not by N.
CREATE INDEX idx_dag_registry_group ON dag_registry (target_source_id, dag_name);
