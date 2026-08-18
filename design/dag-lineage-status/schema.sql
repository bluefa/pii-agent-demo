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
--
-- There is no mapping table on the consumer side. The transport looks up the
-- DAG's databaseUri at publish time and puts it on the event; a DAG whose
-- lookup fails is not emitted at all (owner decision), so every row that
-- exists is already attributed to a logical DB.
CREATE TABLE dag_run_status (
    run_id       VARCHAR(36)  PRIMARY KEY,   -- OpenLineage runId (UUID): same for START and terminal events of one run
    namespace    VARCHAR(250) NOT NULL,      -- Composer environment (AIRFLOW__OPENLINEAGE__NAMESPACE)
    dag_id       VARCHAR(250) NOT NULL,      -- Airflow caps dag_id at 250 chars
    -- The logical DB this run processed, carried on the event itself.
    -- ascii, not utf8mb4, on purpose: InnoDB caps an index key at 3072 bytes
    -- and utf8mb4 reserves 4 bytes per char, so indexing 1024 utf8mb4 chars
    -- (4096 bytes) is rejected. URIs are ASCII (RFC 3986), so ascii_bin fits in
    -- 1024 bytes and keeps the comparison case-sensitive.
    database_uri VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    logical_date DATETIME(6)  NOT NULL,      -- day-bucket key; deliberately NOT the event arrival time
    run_type     VARCHAR(50),                -- scheduled | manual | ...
    status       VARCHAR(10)  NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    event_time   DATETIME(6)  NOT NULL,      -- eventTime of the last folded event; guards out-of-order updates
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- Weekly window scan and the 7-day retention delete (WHERE logical_date < ?)
CREATE INDEX idx_dag_run_status_window ON dag_run_status (logical_date);

-- The board's only lookup: one page of databaseUris over the 7-day window.
-- ponytail: full-width key (1024 + 8 bytes). Real URIs are far shorter than the
-- declared max, so this is mostly reserved space rather than stored bytes —
-- switch to a prefix index database_uri(255) if the index size ever bites.
CREATE INDEX idx_dag_run_status_uri ON dag_run_status (database_uri, logical_date);
