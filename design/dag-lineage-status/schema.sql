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

-- Reverse map: dag name -> databaseUri (the logical DB). 1:1 and immutable.
--
-- Why we store it at all: Pipeline Manager answers ONE direction only
-- (dagName -> databaseUri) and only one name per call — no reverse lookup, no
-- bulk (owner-confirmed). A group read arrives holding databaseUris and has to
-- get back to dag names, so the reverse map has to live here.
--
-- Rows are seeded by the event path (INSERT IGNORE per consumed event — a local
-- write, no API call, so ack never waits on Pipeline Manager) and filled in
-- later by DatabaseUriResolver. A DAG that never emitted an event is simply
-- absent, which is correct: the board is keyed by databaseUri, and a
-- databaseUri with no mapped DAG has no runs to report.
--
-- No target_source_id column: group membership is NOT stored. The member list
-- changes (a logical DB can disappear) and Infra Manager is called on every
-- group read anyway, so a stored membership would only be a stale superset.
CREATE TABLE dag_database_uri (
    dag_name     VARCHAR(250) PRIMARY KEY,
    database_uri VARCHAR(500) UNIQUE,               -- NULL until resolved; length TBD against the real URI format
    attempts     INT          NOT NULL DEFAULT 0,   -- failed resolve attempts; caps retries for names Pipeline Manager never answers
    seen_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at  DATETIME(6)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- The UNIQUE index above serves both access paths: `database_uri IN (...)` for
-- a group read, and `database_uri IS NULL` for the resolver's work queue
-- (InnoDB indexes NULLs, so IS NULL is a range scan). No second index.
