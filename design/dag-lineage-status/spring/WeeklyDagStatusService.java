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
 * Weekly board for one target source, keyed by databaseUri:
 *  1) succeededThisWeek + lastSuccessAt (latest success in the window)
 *  2) per-day state: SUCCESS > RUNNING > FAILED, no row -> NOT_SCHEDULED
 *
 * The member list comes from Infra Manager on every request — it is the only
 * moment the target source's databaseUris are known, and it can shrink (a
 * logical DB may disappear), so it is never cached in our schema.
 *
 * A databaseUri with no mapped DAG renders as 7x NOT_SCHEDULED: we only learn
 * dag names from events, so "unmapped" means "never ran", which is the answer
 * anyway.
 *
 * A manual/backfill success counts as that day's SUCCESS (owner decision):
 * run_type is stored but never used as an aggregate filter.
 */
@Service
public class WeeklyDagStatusService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final DagRunStatusRepository repository;
    private final DagDatabaseUriRepository uriRepository;
    private final InfraManagerClient infraManager;

    public WeeklyDagStatusService(DagRunStatusRepository repository,
            DagDatabaseUriRepository uriRepository, InfraManagerClient infraManager) {
        this.repository = repository;
        this.uriRepository = uriRepository;
        this.infraManager = infraManager;
    }

    /** afterDatabaseUri: last databaseUri of the previous page, null for the first page. */
    public List<DagWeeklyStatus> weeklyStatuses(long targetSourceId, String afterDatabaseUri, int size) {
        // ponytail: Infra Manager has no paging yet, so the full member list
        // (up to ~10k) is sorted and sliced here. If paging lands upstream, pass
        // the cursor through instead; if it does not, cache the list per
        // targetSourceId with a short TTL so page 2..N skip the refetch.
        List<String> page = infraManager.databaseUris(targetSourceId).stream()
                .sorted()
                .dropWhile(uri -> afterDatabaseUri != null && uri.compareTo(afterDatabaseUri) <= 0)
                .limit(size)
                .toList();

        LocalDate firstDay = LocalDate.now(KST).minusDays(6);
        OffsetDateTime windowStart = firstDay.atStartOfDay(KST).toOffsetDateTime();

        Map<String, String> dagNameByUri = uriRepository.findByDatabaseUris(page).stream()
                .collect(Collectors.toMap(DagDatabaseUri::databaseUri, DagDatabaseUri::dagName));
        Map<String, List<DayStatusRow>> rowsByDag =
                repository.dayStatuses(List.copyOf(dagNameByUri.values()), windowStart).stream()
                        .collect(Collectors.groupingBy(DayStatusRow::dagId));

        return page.stream()
                .map(uri -> {
                    String dagName = dagNameByUri.get(uri);
                    return summarize(uri, dagName, firstDay,
                            rowsByDag.getOrDefault(dagName, List.of()));
                })
                .toList();
    }

    private static DagWeeklyStatus summarize(String databaseUri, String dagName, LocalDate firstDay,
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
        return new DagWeeklyStatus(databaseUri, dagName, namespace,
                lastSuccessAt != null, lastSuccessAt, days);
    }

    /**
     * Adapter for Infra Manager: targetSourceId -> the databaseUris of that
     * target source. A non-2xx response is a failed read, not an empty group —
     * throw, so the caller never renders "no logical DBs" for an outage.
     */
    public interface InfraManagerClient {
        List<String> databaseUris(long targetSourceId);
    }
}
