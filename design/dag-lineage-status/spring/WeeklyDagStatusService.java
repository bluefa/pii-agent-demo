package com.example.lineage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;

/**
 * Weekly board: for each DAG in the catalog, the last 7 KST days.
 *  1) succeededThisWeek + lastSuccessAt (latest success in the window)
 *  2) per-day state: SUCCESS > RUNNING > FAILED, no row -> NOT_SCHEDULED
 *
 * Pages over dag_registry (keyset by dag_name), so a DAG with zero events
 * still renders as 7x NOT_SCHEDULED instead of disappearing.
 *
 * A manual/backfill success counts as that day's SUCCESS (owner decision):
 * run_type is stored but never used as an aggregate filter.
 */
@Service
public class WeeklyDagStatusService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final DagRunStatusRepository repository;
    private final DagRegistryRepository registry;

    public WeeklyDagStatusService(DagRunStatusRepository repository, DagRegistryRepository registry) {
        this.repository = repository;
        this.registry = registry;
    }

    /** afterDagName: last dag name of the previous page, null for the first page. */
    public List<DagWeeklyStatus> weeklyStatuses(String afterDagName, int size) {
        return summarizePage(registry.page(afterDagName, size));
    }

    /**
     * Same board, scoped to one group (target source). The page comes from the
     * group's slice of the registry; aggregation is identical. A group can hold
     * up to ~10k DAGs, but each request still touches only one page of them.
     */
    public List<DagWeeklyStatus> weeklyStatusesByGroup(String targetSourceId, String afterDagName, int size) {
        return summarizePage(registry.pageByGroup(targetSourceId, afterDagName, size));
    }

    private List<DagWeeklyStatus> summarizePage(List<DagCatalogEntry> page) {
        LocalDate firstDay = LocalDate.now(KST).minusDays(6);
        OffsetDateTime windowStart = firstDay.atStartOfDay(KST).toOffsetDateTime();

        List<String> names = page.stream().map(DagCatalogEntry::dagName).toList();
        Map<String, List<DayStatusRow>> rowsByDag =
                repository.dayStatuses(names, windowStart).stream()
                        .collect(Collectors.groupingBy(DayStatusRow::dagId));

        return page.stream()
                .map(entry -> summarize(entry, firstDay,
                        rowsByDag.getOrDefault(entry.dagName(), List.of())))
                .toList();
    }

    private static DagWeeklyStatus summarize(DagCatalogEntry entry, LocalDate firstDay,
            List<DayStatusRow> rows) {
        Map<LocalDate, DayStatusRow> byDay =
                rows.stream().collect(Collectors.toMap(DayStatusRow::day, row -> row));

        List<DagWeeklyStatus.DayStatus> days = IntStream.rangeClosed(0, 6)
                .mapToObj(firstDay::plusDays)
                .map(day -> {
                    DayStatusRow row = byDay.get(day);
                    // No event at all that day -> the DAG was never scheduled.
                    return row == null
                            ? new DagWeeklyStatus.DayStatus(day, DayState.NOT_SCHEDULED, null)
                            : new DagWeeklyStatus.DayStatus(day, row.state(), row.successTime());
                })
                .toList();

        OffsetDateTime lastSuccessAt = rows.stream()
                .map(DayStatusRow::successTime)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);

        String namespace = rows.isEmpty() ? null : rows.get(0).namespace();
        return new DagWeeklyStatus(namespace, entry.dagName(), entry.externalId(),
                lastSuccessAt != null, lastSuccessAt, days);
    }
}
