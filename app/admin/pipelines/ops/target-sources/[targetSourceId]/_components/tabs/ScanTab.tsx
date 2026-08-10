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
import { isScanFinalizing, useScanPolling } from '@/app/hooks/useScanPolling';
import { useModal } from '@/app/hooks/useModal';
import { useScanCompletionTransition } from '@/app/hooks/useScanCompletionTransition';
import { normalizeCloudProvider } from '@/lib/types';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ScanCredentialCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanCredentialCard';
import type { RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { RecentScanCard, type TypeEntry } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RecentScanCard';
import { ScanHistoryCard, SCAN_HISTORY_PAGE_SIZE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanHistoryCard';
import { ScanDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanDetailModal';
import { sortResourceCounts, totalOf, type ScanJob } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';

export interface ScanTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Action CTA of the permission card — passed down because OpsTargetView owns
      RoleEditModal. Only AWS, the one provider with a register/edit contract, sends it. */
  onEditRole?: (role: RoleKind) => void;
  /** Changes when a role is saved — makes the permission card re-verify. */
  credentialReloadKey?: string;
}

export function ScanTab({
  targetSourceId,
  detail,
  onEditRole,
  credentialReloadKey,
}: ScanTabProps): ReactElement {
  const provider = normalizeCloudProvider(detail.cloud_provider);
  // 카드는 결과를 이미 손에 쥐고 있으므로(같은 잡의 건수 맵) 대기할 데이터가 없다
  // — dataPending 없이, settling 이 바를 100%로 정착시키고 남은 dwell 은 아래
  // 이력 표의 리로드를 카드 전환 뒤로 미루는 데 쓰인다.
  const completion = useScanCompletionTransition();
  const { latestJob: rawLatestJob, loading, error, refresh, expectCompletion } = useScanPolling(targetSourceId, {
    onScanComplete: completion.begin,
  });
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
  // SUCCESS without a count map is the aggregation tail, not an outcome — the
  // card keeps its running treatment until the numbers are readable.
  const finalizing = isScanFinalizing(latestJob);
  const running = scanning || finalizing;

  // A finished scan adds a history row whatever its outcome, so reload on the
  // running→terminal edge (not only on success). The ref starts false, so
  // mounting on an already-terminal job does not double-fetch page 0.
  //
  // 확인 전환도 "아직 안 끝남"에 포함한다 — 카드가 결과로 넘어가는 순간 아래 표까지
  // 같이 출렁이면 화면 두 곳이 동시에 바뀐다. 실패로 끝난 스캔은 전환을 타지 않으므로
  // (onScanComplete 는 SUCCESS 에만 발화) 예전처럼 즉시 리로드된다.
  const busy = running || completion.stage !== 'idle';
  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (wasBusyRef.current && !busy) void loadHistory(0);
    wasBusyRef.current = busy;
  }, [busy, loadHistory]);

  const runScan = useCallback(async (): Promise<void> => {
    setStarting(true);
    setStartFailed(false);
    try {
      const startedJob = await startScan(targetSourceId);
      // 이 클라이언트가 시작한 스캔임을 알린다(ScanController 와 같은 문법). 빠른
      // 스캔은 아래 refresh() 시점에 이미 종료돼 있어 SCANNING 을 한 번도 관찰하지
      // 못하는데, 그때 id 없는 응답이면 완료가 아예 발화되지 않는다.
      expectCompletion(startedJob.id ?? undefined);
      // Pull the new job in immediately — useScanPolling resumes polling by
      // itself once it observes SCANNING.
      await refresh();
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }, [targetSourceId, refresh, expectCompletion]);

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
      finalizing={finalizing}
      completionStage={completion.stage}
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
          <ScanCredentialCard
            provider={provider}
            targetSourceId={targetSourceId}
            onEditRole={onEditRole}
            reloadKey={credentialReloadKey}
          />
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
