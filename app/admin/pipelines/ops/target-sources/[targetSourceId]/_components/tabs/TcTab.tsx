'use client';

/**
 * Test Connection 탭 — the scan tab's hierarchy applied to connection testing.
 *
 * Reading order (top to bottom): 이 대상이 쓰는 자격 증명 / 최근 실행이 통과했는가
 * → 리소스별 상세 → 회차 이력 → 관리자 결정. The pair on top shares one row so
 * "credential 이 배정돼 있는가" and "그래서 붙었는가" are read side by side; the
 * decision card stays last because it is made BY READING everything above it.
 *
 * This file owns data flow only (fetching, paging, polling, the run trigger);
 * every card is a pure view.
 *
 * Execution history is fetched HERE rather than in the history card, because the
 * newest run drives three things at once — the latest-run card, the run button's
 * enabled state, and when to stop polling. `firstPageRows` snapshots page 0 so
 * paging through the history table cannot change what "the latest run" means.
 *
 * One shared `reloadKey` is the refresh signal for the status/results/confirmed
 * fetch: every write in the tab (실행 / 재실행 요청 / 설치 완료 / 논리 DB 정책 /
 * Credential) bumps it, because each of them changes at least one other card.
 * The 승인·반려 이력 modal mounts per open, so it always fetches fresh.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  getConfirmedIntegration,
  getSecrets,
  triggerTestConnection,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import {
  getTestConnectionDetail,
  getTestConnectionExecutionHistory,
  getTestConnectionResults,
  type TcExecutionRow,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcCredentialCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialCard';
import { TcLatestRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard';
import {
  TcRunHistoryCard,
  TC_RUN_HISTORY_PAGE_SIZE,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunHistoryCard';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcDecisionCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcDecisionCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';
import { tcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** Same cadence as the user-side Step 5 poll (useTestConnectionPolling). */
const POLL_MS = 4_000;

export interface TcTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function TcTab({ targetSourceId, detail }: TcTabProps): ReactElement {
  const toast = usePlToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const [status, setStatus] = useState<TestConnectionStatusRow | null>(null);
  const [results, setResults] = useState<TcResultRow[]>([]);
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedIntegrationResourceItem[]>([]);
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
      // Best-effort across the board: one failed fetch must not blank the cards
      // that the other three feed.
      const [statusRow, resultRows, confirmed, secretList] = await Promise.allSettled([
        getTestConnectionDetail(targetSourceId),
        getTestConnectionResults(targetSourceId),
        getConfirmedIntegration(targetSourceId),
        getSecrets(targetSourceId),
      ]);
      if (cancelled) return;
      setStatus(statusRow.status === 'fulfilled' ? statusRow.value : null);
      setResults(resultRows.status === 'fulfilled' ? resultRows.value : []);
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

  // --- 실행 기록 -------------------------------------------------------------
  const [runRows, setRunRows] = useState<TcExecutionRow[]>([]);
  // Page-0 snapshot — "the latest run" must not change while the operator pages
  // through the history table below.
  const [firstPageRuns, setFirstPageRuns] = useState<TcExecutionRow[]>([]);
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
        if (nextPage === 0) setFirstPageRuns(data.content);
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

  const latestRun = firstPageRuns[0] ?? null;
  const running = latestRun?.status === 'PENDING' || latestRun?.status === 'RUNNING';

  // Poll only while the newest run is unsettled; the interval clears itself the
  // moment it reaches SUCCESS/FAIL, so an idle tab makes no requests. `quiet` so
  // a poll swaps rows in place instead of flashing the skeleton every 4 seconds.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void loadRuns(runPage, { quiet: true }), POLL_MS);
    return () => clearInterval(id);
  }, [running, runPage, loadRuns]);

  // A finished run rewrites the result table, so reload the tab on the settle edge.
  // The ref starts false, so mounting on an already-settled run does not double-fetch.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) reload();
    wasRunning.current = running;
  }, [running, reload]);

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
      await loadRuns(0);
    } catch {
      setTriggerFailed(true);
    } finally {
      setTriggering(false);
    }
  }, [targetSourceId, loadRuns, toast]);

  return (
    <>
      <div className={opsStyles.cardsRow}>
        <TcCredentialCard
          secrets={secrets}
          rows={confirmedRows}
          loading={!settled}
          failed={secretsFailed}
        />
        <TcLatestRunCard
          latestRun={latestRun}
          status={settled ? status : null}
          stats={tcResultStats(results)}
          loading={runsLoading}
          failed={runsFailed}
          running={running}
          triggering={triggering}
          triggerFailed={triggerFailed}
          onRunTest={() => void runTest()}
        />
      </div>

      <ConfirmedInfoCard
        targetSourceId={targetSourceId}
        rows={confirmedRows}
        secrets={secrets}
        tcResults={settled ? results : []}
        loading={!settled}
        failed={confirmedFailed}
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

      <TcDecisionCard
        targetSourceId={targetSourceId}
        detail={detail}
        status={settled ? status : null}
        stats={tcResultStats(results)}
        onReload={reload}
      />

      {historyOpen && (
        <TcHistoryModal targetSourceId={targetSourceId} onClose={() => setHistoryOpen(false)} />
      )}
    </>
  );
}
