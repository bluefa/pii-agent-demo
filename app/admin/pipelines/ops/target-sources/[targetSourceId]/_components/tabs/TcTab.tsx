'use client';

/**
 * Test Connection 탭 — the scan tab's hierarchy applied to connection testing.
 *
 * Reading order (top to bottom): 이 대상이 쓰는 자격 증명 / 최근 실행이 통과했는가
 * → 리소스별 상세 → 회차 이력. The pair on top shares one row so "credential 이
 * 배정돼 있는가" and "그래서 붙었는가" are read side by side.
 *
 * 관리자 처리 is NOT here — it is a process branch (Step 6 → 7 / → 5), so it lives
 * on the tab rail (TcDecisionActions) where it is visible from every tab instead
 * of buried under four cards inside this one.
 *
 * This file owns data flow only (fetching, paging, polling, the run trigger);
 * every card is a pure view. TC status/results/latest come from the page, which
 * needs the same three for the 관리자 승인 tab.
 *
 * 두 개의 실행 엔드포인트를 각자 선언한 것만 쓴다 —
 *   latest_version      최신 실행(회차·상태·시각) + 리소스별 판정. 404 = 실행 없음.
 *   execution-history   회차 목록(표). 여기서 "최신"을 유추하지 않는다.
 * 폴링도 latest_version 의 connection_status 로 판단한다: 그것이 계약이 말하는
 * "진행 중"이고, 실행 기록 표의 첫 행을 최신으로 추정하는 것보다 정확하다.
 *
 * `reloadKey` refreshes the confirmed snapshot + credential list after a write in
 * the tab (논리 DB 정책 / Credential 배정). The 승인·반려 이력 modal mounts per open,
 * so it always fetches fresh.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  getConfirmedIntegration,
  getSecrets,
  triggerTestConnection,
  type ConfirmedIntegrationResourceItem,
  type TestConnectionVersionResult,
} from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';
import {
  getTestConnectionExecutionHistory,
  type TcExecutionRow,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import { getApprovalRequestLatest } from '@/app/lib/api/task-queue-requests';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { TcLatestRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard';
import {
  TcRunHistoryCard,
  TC_RUN_HISTORY_PAGE_SIZE,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunHistoryCard';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';
import {
  isRunOpen,
  orderByRequest,
  tcFactsByResource,
  tcResultStats,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** Same cadence as the user-side Step 5 poll (useTestConnectionPolling). */
const POLL_MS = 4_000;

export interface TcTabProps {
  targetSourceId: number;
  /** Picks 확정 정보's identity columns — an IDC row has an address, not a name/region. */
  isIdc: boolean;
  /** Service acknowledgment row — fetched by the page (관리자 승인 탭이 여기에 게이트). */
  status: TestConnectionStatusRow | null;
  /** 최신 실행 (latest_version) — 실행 이력이 없으면 null. Fetched by the page. */
  latest: TestConnectionVersionResult | null;
  /** 리소스별 논리 DB 건수 (latest-results) — fetched by the page. */
  results: readonly TcResultRow[];
  /** Page-level TC fetch has settled at least once. */
  statusLoaded: boolean;
  /** latest_version 조회가 404 가 아닌 이유로 실패했다. */
  latestFailed: boolean;
  /** Reload the page-level TC fetch (status + latest + results). */
  onStatusReload: () => void;
}

export function TcTab({
  targetSourceId,
  isIdc,
  status,
  latest,
  results,
  statusLoaded,
  latestFailed,
  onStatusReload,
}: TcTabProps): ReactElement {
  const toast = usePlToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const [confirmedRows, setConfirmedRows] = useState<ConfirmedIntegrationResourceItem[]>([]);
  // Step 2(연동 요청) 표의 리소스 순서 — 확정 정보를 같은 순서로 세워 두 화면을 행 단위로
  // 대조할 수 있게 한다.
  const [requestOrder, setRequestOrder] = useState<string[]>([]);
  const [secrets, setSecrets] = useState<SecretKey[]>([]);
  const [confirmedFailed, setConfirmedFailed] = useState(false);
  const [secretsFailed, setSecretsFailed] = useState(false);

  // Loading is derived from "which load has settled" rather than its own flag, so
  // the effect never calls setState synchronously in its body.
  const loadKey = `${targetSourceId}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Best-effort: a failed credential list must not blank the resource table,
      // and vice versa. The approval request is fetched only for its row ORDER —
      // losing it leaves the confirmed order, never an empty table.
      const [confirmed, secretList, request] = await Promise.allSettled([
        getConfirmedIntegration(targetSourceId),
        getSecrets(targetSourceId),
        getApprovalRequestLatest(targetSourceId),
      ]);
      if (cancelled) return;
      setRequestOrder(
        request.status === 'fulfilled'
          ? request.value.resources.map((resource) => resource.resourceId ?? '').filter(Boolean)
          : [],
      );
      if (confirmed.status === 'fulfilled') {
        setConfirmedRows(confirmed.value.resource_infos ?? []);
        setConfirmedFailed(false);
      } else {
        setConfirmedRows([]);
        // The route encodes "not confirmed yet" as a 404 problem — empty state, not failure.
        setConfirmedFailed(!isMissingConfirmedIntegrationError(confirmed.reason));
      }
      setSecrets(secretList.status === 'fulfilled' ? secretList.value : []);
      setSecretsFailed(secretList.status !== 'fulfilled');
      setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, loadKey]);

  // "Has a load settled at least once", not "has THIS load settled" — a reload
  // triggered by a write in the tab keeps the current values on screen instead of
  // blanking every card until the refetch lands.
  const settled = loadedKey !== null;
  const orderedRows = orderByRequest(confirmedRows, requestOrder);

  // --- 실행 기록 (표 전용) ----------------------------------------------------
  const [runRows, setRunRows] = useState<TcExecutionRow[]>([]);
  const [runPage, setRunPage] = useState(0);
  const [runTotalPages, setRunTotalPages] = useState(1);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsFailed, setRunsFailed] = useState(false);

  // Latest-request-wins: rapid pagination can resolve out of order, and a stale
  // response must not commit page/rows over a newer one.
  const runSeq = useRef(0);
  const loadRuns = useCallback(
    async (nextPage: number, { quiet = false } = {}): Promise<void> => {
      const seq = ++runSeq.current;
      if (!quiet) setRunsLoading(true);
      try {
        const data = await getTestConnectionExecutionHistory(
          targetSourceId,
          nextPage,
          TC_RUN_HISTORY_PAGE_SIZE,
        );
        if (seq !== runSeq.current) return;
        setRunRows(data.content);
        setRunTotalPages(Math.max(1, data.totalPages));
        setRunPage(nextPage);
        setRunsFailed(false);
      } catch {
        if (seq !== runSeq.current) return;
        setRunsFailed(true);
      } finally {
        if (seq === runSeq.current && !quiet) setRunsLoading(false);
      }
    },
    [targetSourceId],
  );

  useEffect(() => {
    void loadRuns(0);
  }, [loadRuns]);

  const running = isRunOpen(latest);

  // Poll only while the run is unsettled; the interval clears itself the moment
  // connection_status reaches SUCCESS/FAIL, so an idle tab makes no requests.
  // `quiet` so a poll swaps history rows in place instead of flashing the
  // skeleton every 4 seconds.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      onStatusReload();
      void loadRuns(runPage, { quiet: true });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running, runPage, loadRuns, onStatusReload]);

  // A finished run rewrites the 논리 DB 결과 and can change the confirmed snapshot,
  // so the settle edge reloads both — the poll tick that observed SUCCESS can race
  // the results write. The ref starts false, so mounting on an already-settled run
  // does not double-fetch.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      reload();
      onStatusReload();
      void loadRuns(0);
    }
    wasRunning.current = running;
  }, [running, reload, onStatusReload, loadRuns]);

  const [triggering, setTriggering] = useState(false);
  const [triggerFailed, setTriggerFailed] = useState(false);
  // The server owns eligibility (409 while running / 4xx before install), so this
  // just reports; the button is disabled while a run is open to spare a request
  // that can only be refused.
  const runTest = useCallback(async (): Promise<void> => {
    setTriggering(true);
    setTriggerFailed(false);
    try {
      await triggerTestConnection(targetSourceId);
      toast.show('연결 테스트 실행을 요청했습니다.');
      // latest_version 이 새 회차를 RUNNING 으로 보고해야 폴링이 시작된다.
      onStatusReload();
      await loadRuns(0);
    } catch {
      setTriggerFailed(true);
    } finally {
      setTriggering(false);
    }
  }, [targetSourceId, loadRuns, onStatusReload, toast]);

  return (
    <>
      {/* 집계는 밴드로, 사실은 표로 — 종합 상태 밴드가 확정 정보 표 바로 위에 서고,
          리소스별 사실(연결 상태·실패 사유·Pod 로그)은 전부 표의 열이다. 실행 기록은
          과거 조회라 표 뒤로 내려간다. */}
      <TcLatestRunCard
        latest={latest}
        status={statusLoaded ? status : null}
        stats={tcResultStats(results, latest)}
        confirmedResourceCount={orderedRows.length}
        loading={!statusLoaded}
        failed={latestFailed}
        running={running}
        triggering={triggering}
        triggerFailed={triggerFailed}
        onRunTest={() => void runTest()}
      />

      <ConfirmedInfoCard
        targetSourceId={targetSourceId}
        isIdc={isIdc}
        rows={orderedRows}
        secrets={secrets}
        tcResults={statusLoaded ? results : []}
        facts={tcFactsByResource(statusLoaded ? latest : null)}
        loading={!settled}
        failed={confirmedFailed}
        secretsFailed={secretsFailed}
        onReload={reload}
      />

      <TcRunHistoryCard
        rows={runRows}
        page={runPage}
        totalPages={runTotalPages}
        loading={runsLoading}
        failed={runsFailed}
        onPage={(next) => void loadRuns(next)}
        onOpenDecisionHistory={() => setHistoryOpen(true)}
      />

      {historyOpen && (
        <TcHistoryModal targetSourceId={targetSourceId} onClose={() => setHistoryOpen(false)} />
      )}
    </>
  );
}
