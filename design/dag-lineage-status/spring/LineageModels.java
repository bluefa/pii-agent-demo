package com.example.lineage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Skeleton: package-private records shared within the lineage package.
// Promote to public/API-layer DTOs when a controller in another package needs them.

/** Per-run state stored in dag_run_status. */
enum DagRunState { RUNNING, SUCCESS, FAILED }

/** Per-day state shown on the weekly board. */
enum DayState { SUCCESS, RUNNING, FAILED, NOT_SCHEDULED }

/** One folded row of dag_run_status. */
record DagRunRow(
        String runId,
        String namespace,
        String dagId,
        OffsetDateTime logicalDate,
        String runType,
        DagRunState state,
        OffsetDateTime eventTime) {}

/**
 * One row of dag_database_uri (dag names are globally unique across
 * environments). databaseUri is null until DagDatabaseUriSync fills it in;
 * the mapping is 1:1 and immutable, so it is written once.
 */
record DagDatabaseUri(String dagName, String databaseUri) {}

/** One (dag, day) aggregate returned by the day-status query. */
record DayStatusRow(String dagId, String namespace, LocalDate day, DayState state,
        OffsetDateTime successTime) {}

/**
 * Weekly board row, keyed by databaseUri — the board lists what Infra Manager
 * returned for the target source, so databaseUri is always present. dagName is
 * null when no DAG has been mapped to that databaseUri (it never ran), and
 * namespace is null when the DAG had no events in the window (nothing ran, so
 * there is no row to read it from).
 */
record DagWeeklyStatus(
        String databaseUri,
        String dagName,
        String namespace,
        boolean succeededThisWeek,
        OffsetDateTime lastSuccessAt,
        List<DayStatus> days) {

    record DayStatus(LocalDate day, DayState state, OffsetDateTime successTime) {}
}
