'use client';

/**
 * Scan tab container — credential + recent-scan cards in one row, a paged
 * history table below (docs-defined operator question order: is it running /
 * when and did it succeed / why did it fail / are credentials valid / what
 * was found / past pattern). The latest job comes from useScanPolling, so a
 * running scan animates and a never-scanned target surfaces as the empty
 * state rather than an error. Rendering lives in RecentScanCard /
 * ScanHistoryCard / ScanDetailModal; this file owns data flow only
 * (polling, paging, run-scan, diff derivation).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { getScanHistory, startScan } from '@/app/lib/api/scan';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useModal } from '@/app/hooks/useModal';
import { normalizeCloudProvider } from '@/lib/types';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ScanCredentialCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanCredentialCard';
import { RecentScanCard, type TypeEntry } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RecentScanCard';
import { ScanHistoryCard, SCAN_HISTORY_PAGE_SIZE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanHistoryCard';
import { ScanDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanDetailModal';
import { sortResourceCounts, totalOf, type ScanJob } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';

export interface ScanTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function ScanTab({ targetSourceId, detail }: ScanTabProps): ReactElement {
  const provider = normalizeCloudProvider(detail.cloud_provider);
  const { latestJob: rawLatestJob, loading, error, refresh } = useScanPolling(targetSourceId);
  // The mock latest endpoint answers a NO_SCAN placeholder instead of 404 for a
  // never-scanned target — normalize it to "no scan yet" so the empty state wins.
  const latestJob = rawLatestJob?.scan_status === 'NO_SCAN' ? null : rawLatestJob;
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const [rows, setRows] = useState<ScanJob[]>([]);
  // Page-0 snapshot — the "vs previous success" diff must not change while the
  // user paginates the history table below.
  const [firstPageRows, setFirstPageRows] = useState<ScanJob[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  /** History row the detail modal describes (AGENTS.md modal-state contract). */
  const detailModal = useModal<ScanJob>();

  // Latest-request-wins: rapid pagination can resolve out of order, and a stale
  // response must not commit page/rows over a newer one.
  const historySeq = useRef(0);
  const loadHistory = useCallback(async (nextPage: number): Promise<void> => {
    const seq = ++historySeq.current;
    setHistoryLoading(true);
    setHistoryFailed(false);
    try {
      const data = await getScanHistory(targetSourceId, nextPage, SCAN_HISTORY_PAGE_SIZE);
      if (seq !== historySeq.current) return;
      const content = data.content ?? [];
      setRows(content);
      if (nextPage === 0) setFirstPageRows(content);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      if (seq !== historySeq.current) return;
      setHistoryFailed(true);
    } finally {
      if (seq === historySeq.current) setHistoryLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void loadHistory(0);
  }, [loadHistory]);

  const scanning = latestJob?.scan_status === 'SCANNING';

  // A finished scan adds a history row whatever its outcome, so reload on the
  // SCANNING→terminal edge (not only on success). The ref starts false, so
  // mounting on an already-terminal job does not double-fetch page 0.
  const wasScanningRef = useRef(false);
  useEffect(() => {
    if (wasScanningRef.current && !scanning) void loadHistory(0);
    wasScanningRef.current = scanning;
  }, [scanning, loadHistory]);

  const runScan = useCallback(async (): Promise<void> => {
    setStarting(true);
    setStartFailed(false);
    try {
      await startScan(targetSourceId);
      // Pull the new job in immediately — useScanPolling resumes polling by
      // itself once it observes SCANNING.
      await refresh();
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }, [targetSourceId, refresh]);

  const latestCounts = sortResourceCounts(latestJob?.resource_count_by_resource_type);
  const latestTotal = totalOf(latestCounts);

  // Diff vs the previous success — derived from the page-0 snapshot so it is
  // immune to pagination.
  // ponytail: a previous success older than page one (5 rows) omits the diff; go server-derived if that ever matters.
  const prevSuccess =
    latestJob?.scan_status === 'SUCCESS'
      ? firstPageRows.find(
          (row) =>
            row.id !== latestJob.id
            && row.scan_status === 'SUCCESS'
            && row.resource_count_by_resource_type != null,
        )
      : undefined;
  const countDiff = prevSuccess
    ? latestTotal - totalOf(sortResourceCounts(prevSuccess.resource_count_by_resource_type))
    : null;

  // Per-type diff — with a previous success, diff over the union of current ∪
  // previous keys. A type present only previously stays at count 0 (gone), so
  // its −N is reported honestly.
  const typeEntries: TypeEntry[] = (() => {
    if (!prevSuccess) return latestCounts.map(([type, count]) => ({ type, count, diff: null }));
    const prevMap = Object.fromEntries(sortResourceCounts(prevSuccess.resource_count_by_resource_type));
    const currentMap = Object.fromEntries(latestCounts);
    return Array.from(new Set([...Object.keys(currentMap), ...Object.keys(prevMap)]))
      .map((type) => {
        const count = currentMap[type] ?? 0;
        return { type, count, diff: count - (prevMap[type] ?? 0) };
      })
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  })();

  const recentScanCard = (
    <RecentScanCard
      provider={provider}
      latestJob={latestJob}
      loading={loading}
      failed={error !== null}
      scanning={scanning}
      starting={starting}
      startFailed={startFailed}
      typeEntries={typeEntries}
      countDiff={countDiff}
      latestTotal={latestTotal}
      onRunScan={() => void runScan()}
    />
  );

  return (
    <>
      {/* IDC has no cloud scan credential — skip that card; recent scan takes the full row. */}
      {provider === 'IDC' ? (
        recentScanCard
      ) : (
        <div className={opsStyles.cardsRow}>
          <ScanCredentialCard provider={provider} targetSourceId={targetSourceId} />
          {recentScanCard}
        </div>
      )}

      <ScanHistoryCard
        rows={rows}
        page={page}
        totalPages={totalPages}
        loading={historyLoading}
        failed={historyFailed}
        onPage={(next) => void loadHistory(next)}
        onRowOpen={detailModal.open}
      />

      <ScanDetailModal
        open={detailModal.isOpen}
        job={detailModal.data}
        provider={provider}
        onClose={detailModal.close}
      />
    </>
  );
}
