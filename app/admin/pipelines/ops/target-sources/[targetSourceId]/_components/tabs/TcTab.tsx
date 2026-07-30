'use client';

/**
 * Test Connection 탭 — 실행/기록 → 결과 → 처리, 한 화면.
 *
 * One tab, not two: the 재실행 요청 / 설치 완료 decision is made BY READING the
 * result table right above it, so splitting them across tabs would only make the
 * operator hop back and forth for a single binary choice.
 *
 * The status row and the latest results load here (both cards read them) and do
 * so best-effort: a failed results fetch still renders the status head, and a
 * missing status row still renders whatever results exist.
 *
 * One shared `reloadKey` is the tab's refresh signal: every write in the tab
 * (실행 / 재실행 요청 / 설치 완료 / 논리 DB 정책 / Credential) bumps it, because each of
 * them changes at least one other card. The 처리 이력 modal mounts per open, so it
 * always fetches the fresh trail and needs no reload plumbing.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import {
  getTestConnectionDetail,
  getTestConnectionResults,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { TcRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunCard';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcDecisionCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcDecisionCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';
import { tcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

export interface TcTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function TcTab({ targetSourceId, detail }: TcTabProps): ReactElement {
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const [status, setStatus] = useState<TestConnectionStatusRow | null>(null);
  const [results, setResults] = useState<TcResultRow[]>([]);

  // Loading is derived from "which load has settled" rather than its own flag, so
  // the effect never calls setState synchronously in its body.
  const loadKey = `${targetSourceId}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statusRow, resultRows] = await Promise.allSettled([
        getTestConnectionDetail(targetSourceId),
        getTestConnectionResults(targetSourceId),
      ]);
      if (cancelled) return;
      setStatus(statusRow.status === 'fulfilled' ? statusRow.value : null);
      setResults(resultRows.status === 'fulfilled' ? resultRows.value : []);
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

  return (
    <>
      <TcRunCard
        targetSourceId={targetSourceId}
        status={settled ? status : null}
        reloadKey={reloadKey}
        onReload={reload}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <ConfirmedInfoCard
        targetSourceId={targetSourceId}
        tcResults={settled ? results : []}
        reloadKey={reloadKey}
        onReload={reload}
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
