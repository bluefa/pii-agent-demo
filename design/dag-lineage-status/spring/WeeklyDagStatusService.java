package com.example.lineage;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Weekly board for one target source, keyed by databaseUri:
 *  1) succeededThisWeek + lastSuccessAt (latest success in the window)
 *  2) per-day state: SUCCESS > RUNNING > FAILED, no row -> NOT_SCHEDULED
 *
 * The member list comes from Infra Manager — the only place the target
 * source's databaseUris are known. It can shrink (a logical DB may disappear),
 * so it is never persisted; a short in-memory TTL only keeps paging from
 * refetching the same 10k list per page.
 *
 * A databaseUri with no rows renders as 7x NOT_SCHEDULED. There is no mapping
 * to consult: runs carry their own databaseUri, so "no rows" means "nothing ran
 * for this logical DB in the window" — which covers a DAG that did not run, a
 * logical DB with no DAG at all, and a DAG whose events never reached us. The
 * board does not distinguish them; the third one is caught by watching event
 * arrival per namespace, not from here.
 *
 * A manual/backfill success counts as that day's SUCCESS (owner decision):
 * run_type is stored but never used as an aggregate filter.
 */
@Service
public class WeeklyDagStatusService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final DagRunStatusRepository repository;
    private final InfraManagerClient infraManager;
    private final Map<Long, Cached> memberCache = new ConcurrentHashMap<>();
    private final Duration ttl;

    public WeeklyDagStatusService(DagRunStatusRepository repository,
            InfraManagerClient infraManager,
            @Value("${lineage.members.ttl:PT60S}") Duration ttl) {
        this.repository = repository;
        this.infraManager = infraManager;
        this.ttl = ttl;
    }

    /** afterDatabaseUri: last databaseUri of the previous page, null for the first page. */
    public List<DagWeeklyStatus> weeklyStatuses(long targetSourceId, String afterDatabaseUri, int size) {
        List<String> page = members(targetSourceId).stream()
                .dropWhile(uri -> afterDatabaseUri != null && uri.compareTo(afterDatabaseUri) <= 0)
                .limit(size)
                .toList();

        LocalDate firstDay = LocalDate.now(KST).minusDays(6);
        OffsetDateTime windowStart = firstDay.atStartOfDay(KST).toOffsetDateTime();

        Map<String, List<DayStatusRow>> rowsByUri =
                repository.dayStatuses(page, windowStart).stream()
                        .collect(Collectors.groupingBy(DayStatusRow::databaseUri));

        return page.stream()
                .map(uri -> summarize(uri, firstDay, rowsByUri.getOrDefault(uri, List.of())))
                .toList();
    }

    /**
     * The target source's members, sorted so paging is stable.
     *
     * Infra Manager has no paging (owner-confirmed), so one call returns all
     * ~10k members — up to ~10MB with 1KB URIs. Without a cache, every page of
     * the board would refetch that whole list. A TTL is the only invalidation
     * needed: the list changes, but nothing here can observe the change, so
     * staleness is bounded by the TTL and never by a missed event.
     *
     * A failed call is NOT cached and NOT swallowed — an outage must surface as
     * a failed read, never as an empty or stale group.
     */
    private List<String> members(long targetSourceId) {
        long now = System.nanoTime();
        Cached hit = memberCache.get(targetSourceId);
        if (hit != null && hit.expiresAt() > now) {
            return hit.databaseUris();
        }
        List<String> fresh = infraManager.databaseUris(targetSourceId).stream().sorted().toList();
        memberCache.put(targetSourceId, new Cached(fresh, now + ttl.toNanos()));
        return fresh;
    }

    // ponytail: one entry per target source, never evicted except by overwrite.
    // Fine while target sources number in the hundreds; swap for a size-bounded
    // cache if that stops being true.
    private record Cached(List<String> databaseUris, long expiresAt) {}

    private static DagWeeklyStatus summarize(String databaseUri, LocalDate firstDay,
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

        // Both read off the run rows, so both are null when nothing ran.
        String dagName = rows.isEmpty() ? null : rows.get(0).dagId();
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
