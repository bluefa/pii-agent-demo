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

record DagKey(String namespace, String dagId) {}

/** One (dag, day) aggregate returned by the day-status query. */
record DayStatusRow(DagKey key, LocalDate day, DayState state, OffsetDateTime successTime) {}

/** Weekly board row for one DAG. */
record DagWeeklyStatus(
        String namespace,
        String dagId,
        boolean succeededThisWeek,
        OffsetDateTime lastSuccessAt,
        List<DayStatus> days) {

    record DayStatus(LocalDate day, DayState state, OffsetDateTime successTime) {}
}
