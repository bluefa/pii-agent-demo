-- One row per DagRun, folded from OpenLineage DAG-level events.
-- Raw events are NOT kept here (BigQuery export subscription holds them).
CREATE TABLE dag_run_status (
    run_id       text PRIMARY KEY,      -- OpenLineage runId: same UUID for START and terminal events of one run
    namespace    text NOT NULL,         -- Composer environment (AIRFLOW__OPENLINEAGE__NAMESPACE)
    dag_id       text NOT NULL,
    logical_date timestamptz NOT NULL,  -- day-bucket key; deliberately NOT the event arrival time
    run_type     text,                  -- scheduled | manual | ...
    status       text NOT NULL,         -- RUNNING | SUCCESS | FAILED
    event_time   timestamptz NOT NULL,  -- eventTime of the last folded event; guards out-of-order updates
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Weekly window scan (WHERE logical_date >= ?)
CREATE INDEX idx_dag_run_status_window ON dag_run_status (logical_date);

-- Per-DAG lookup and DISTINCT paging
CREATE INDEX idx_dag_run_status_dag ON dag_run_status (namespace, dag_id, logical_date);
