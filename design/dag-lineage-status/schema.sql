-- One row per DagRun, folded from OpenLineage DAG-level events.
-- Raw events are NOT kept here (BigQuery export subscription holds them).
CREATE TABLE dag_run_status (
    run_id       text PRIMARY KEY,      -- OpenLineage runId: same UUID for START and terminal events of one run
    namespace    text NOT NULL,         -- Composer environment (AIRFLOW__OPENLINEAGE__NAMESPACE)
    dag_id       text NOT NULL,
    logical_date timestamptz NOT NULL,  -- day-bucket key; deliberately NOT the event arrival time
    run_type     text,                  -- scheduled | manual | ...
    status       text NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    event_time   timestamptz NOT NULL,  -- eventTime of the last folded event; guards out-of-order updates
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Weekly window scan and the 30-day retention delete (WHERE logical_date < ?)
CREATE INDEX idx_dag_run_status_window ON dag_run_status (logical_date);

-- Day-status lookup for one page of DAGs (dag names are globally unique)
CREATE INDEX idx_dag_run_status_dag ON dag_run_status (dag_id, logical_date);

-- DAG catalog: name -> external id (1:1; names globally unique across
-- environments — owner-confirmed). Source of truth for WHICH DAGs the weekly
-- board lists. Filled by the initial backfill, then kept in sync with the
-- dag-id API by DagCatalogSync; the event path never calls the id API.
CREATE TABLE dag_registry (
    dag_name    text PRIMARY KEY,
    external_id text NOT NULL UNIQUE,
    synced_at   timestamptz NOT NULL DEFAULT now()  -- liveness marker: rows a full sync did not touch get deleted
);
