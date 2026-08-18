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

/** One folded row of dag_run_status. databaseUri comes off the event. */
record DagRunRow(
        String runId,
        String namespace,
        String dagId,
        String databaseUri,
        OffsetDateTime logicalDate,
        String runType,
        DagRunState state,
        OffsetDateTime eventTime) {}

/** One (databaseUri, day) aggregate returned by the day-status query. */
record DayStatusRow(String databaseUri, String dagId, String namespace, LocalDate day,
        DayState state, OffsetDateTime successTime) {}

/**
 * Weekly board row, keyed by databaseUri — the board lists what Infra Manager
 * returned for the target source, so databaseUri is always present. dagName and
 * namespace are null when nothing ran in the window, because both are read off
 * the run rows and there are none.
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
