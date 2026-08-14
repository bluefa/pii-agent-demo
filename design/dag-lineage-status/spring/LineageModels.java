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
 * One catalog row of dag_registry (dag names are globally unique across
 * environments). targetSourceId is the group axis — null until learned from
 * the first group GET (it is unknowable earlier), immutable afterwards.
 * The catalog sync never fills it.
 */
record DagCatalogEntry(String dagName, String externalId, Long targetSourceId) {}

/** One (dag, day) aggregate returned by the day-status query. */
record DayStatusRow(String dagId, String namespace, LocalDate day, DayState state,
        OffsetDateTime successTime) {}

/**
 * Weekly board row for one DAG. Listed DAGs come from the catalog, so
 * externalId is always present; namespace is null when the DAG had no events
 * in the window (nothing ran, so there is no row to read it from).
 */
record DagWeeklyStatus(
        String namespace,
        String dagId,
        String externalId,
        boolean succeededThisWeek,
        OffsetDateTime lastSuccessAt,
        List<DayStatus> days) {

    record DayStatus(LocalDate day, DayState state, OffsetDateTime successTime) {}
}
