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
 * Weekly board: for each DAG, the last 7 KST days.
 *  1) succeededThisWeek + lastSuccessAt (latest success in the window)
 *  2) per-day state: SUCCESS > RUNNING > FAILED, no row -> NOT_SCHEDULED
 */
@Service
public class WeeklyDagStatusService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final DagRunStatusRepository repository;

    public WeeklyDagStatusService(DagRunStatusRepository repository) {
        this.repository = repository;
    }

    public List<DagWeeklyStatus> weeklyStatuses(int page, int size) {
        LocalDate firstDay = LocalDate.now(KST).minusDays(6);
        OffsetDateTime windowStart = firstDay.atStartOfDay(KST).toOffsetDateTime();

        List<DagKey> keys = repository.pageDagKeys(windowStart, page, size);
        Map<DagKey, List<DayStatusRow>> rowsByDag =
                repository.dayStatuses(keys, windowStart).stream()
                        .collect(Collectors.groupingBy(DayStatusRow::key));

        return keys.stream()
                .map(key -> summarize(key, firstDay, rowsByDag.getOrDefault(key, List.of())))
                .toList();
    }

    private static DagWeeklyStatus summarize(DagKey key, LocalDate firstDay, List<DayStatusRow> rows) {
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

        return new DagWeeklyStatus(key.namespace(), key.dagId(),
                lastSuccessAt != null, lastSuccessAt, days);
    }
}
