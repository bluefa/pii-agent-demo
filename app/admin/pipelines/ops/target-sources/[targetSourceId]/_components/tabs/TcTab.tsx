'use client';

/**
 * Test Connection 탭 — the scan tab's hierarchy applied to connection testing.
 *
 * Reading order (top to bottom): 최근 실행이 통과했는가 → 리소스별 상세. 둘은 **카드 한
 * 장**이다(오너 2026-08-25) — 같은 실행을 집계로 한 번, 리소스별 사실로 한 번 말하는
 * 것이라 껍데기가 두 벌일 이유가 없다. 껍데기는 `TcLatestRunCard` 가 들고 확정 정보 표는
 * 그 children 으로 들어간다. 지난 회차와 결정은 밴드의 링크가 여는 모달이다 — 지면의
 * 마지막 절이 "과거"가 되면 이 탭에 온 이유(지금 무엇이 실패했나)가 화면에서 가장 멀어진다.
 *
 * 관리자 처리 is NOT here — it is a process branch (Step 6 → 7 / → 5), so it lives
 * on the tab rail (TcDecisionActions) where it is visible from every tab instead
 * of buried under four cards inside this one.
 *
 * This file owns data flow only (fetching, paging, polling, the run trigger);
 * every card is a pure view. TC status/results/latest come from the page, which
 * needs the same three for the 관리자 승인 tab.
 *
 * 이 파일이 읽는 실행 엔드포인트는 latest_version 하나다 — 최신 실행(회차·상태·시각)과
 * 리소스별 판정, 404 = 실행 없음. 회차 목록(execution-history)은 열릴 때 스스로 조회하는
 * TcRunHistoryModal 의 몫이라 여기서 "최신"을 유추하지 않는다. 폴링도 latest_version 의
 * connection_status 로 판단한다: 그것이 계약이 말하는 "진행 중"이고, 실행 기록 표의 첫
 * 행을 최신으로 추정하는 것보다 정확하다.
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
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getApprovalRequestLatest } from '@/app/lib/api/task-queue-requests';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { TcLatestRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard';
import { TcRunHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunHistoryModal';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';
import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';
import {
  bandBuckets,
  bandUnitIds,
  credentialMissingCount,
  isRunOpen,
  orderByRequest,
  tcFactsByResource,
  toConfirmedUnits,
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
  /** 승인 요청 상태(status) 조회가 실패했다 — 미요청과 다른 사실이다. */
  statusFailed: boolean;
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
  statusFailed,
  onStatusReload,
}: TcTabProps): ReactElement {
  const toast = usePlToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  // 카드 머리의 텍스트 버튼이 여는 조회 모달 — 표가 아니라 카드의 것이라 여기서 든다.
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  // Credential 미설정만 보기 — 밴드의 경고 줄이 토글하고 아래 표가 적용한다. 요약과 도달
  // 수단이 한 물건이라, 세는 규칙(credentialMissingCount)과 거르는 규칙이 어긋날 수 없다.
  const [credMissingOnly, setCredMissingOnly] = useState(false);
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
  // The progress denominator counts what the test reports on, not what the table lists:
  // one Athena region is one result no matter how many databases it holds. Counting rows
  // here would print 진행 5/7 on a run that only ever produces five results — the same
  // miscount the user-side Step 5 card documents (ConnectionTestCard's TestUnit).
  const units = toConfirmedUnits(orderedRows);
  // 밴드의 분모이자 무보고를 셀 수 있게 하는 집합. 확정 조회가 404·실패면 실행이 실제로
  // 보고한 id 로 떨어진다 — 빈 목록이면 `ok === total` 이 저절로 성립해 아무것도 확인하지
  // 않은 실행을 "모두 성공"이라 부르게 된다.
  const buckets = bandBuckets(bandUnitIds(units, latest), latest);
  const credentialMissing = settled ? credentialMissingCount(units) : 0;

  const running = isRunOpen(latest);

  // Poll only while the run is unsettled; the interval clears itself the moment
  // connection_status reaches SUCCESS/FAIL, so an idle tab makes no requests.
  // 회차 목록은 열릴 때 스스로 조회하는 모달의 몫이라 여기서 폴링하지 않는다.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(onStatusReload, POLL_MS);
    return () => clearInterval(id);
  }, [running, onStatusReload]);

  // A finished run rewrites the 논리 DB 결과 and can change the confirmed snapshot,
  // so the settle edge reloads both — the poll tick that observed SUCCESS can race
  // the results write. The ref starts false, so mounting on an already-settled run
  // does not double-fetch.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      reload();
      onStatusReload();
    }
    wasRunning.current = running;
  }, [running, reload, onStatusReload]);

  // 마지막 하나를 배정하면 경고 줄이 사라진다 — 필터를 그대로 두면 표가 빈 화면이 되고,
  // 그것을 되돌릴 컨트롤(경고 줄의 토글)도 같이 사라진 뒤다. 사라질 때 같이 푼다.
  if (credMissingOnly && credentialMissing === 0) setCredMissingOnly(false);

  const [triggering, setTriggering] = useState(false);
  const [triggerFailed, setTriggerFailed] = useState(false);
  // The server owns eligibility (409 while running / 4xx before install), so this
  // just reports; the button is disabled while a run is open to spare a request
  // that can only be refused.
  const runTest = useCallback(async (): Promise<void> => {
    // 버튼이 이미 잠겨 있지만 게이트는 값에도 둔다 — 배정을 지우는 쓰기가 이 화면에서
    // 일어나므로(Credential 배정 모달), 눌린 순간과 세어진 순간 사이가 벌어질 수 있다.
    if (credentialMissing > 0) return;
    setTriggering(true);
    setTriggerFailed(false);
    try {
      await triggerTestConnection(targetSourceId);
      toast.show('연결 테스트 실행을 요청했습니다.');
      // latest_version 이 새 회차를 RUNNING 으로 보고해야 폴링이 시작된다.
      onStatusReload();
    } catch {
      setTriggerFailed(true);
    } finally {
      setTriggering(false);
    }
  }, [targetSourceId, credentialMissing, onStatusReload, toast]);

  return (
    <>
      {/* 집계는 밴드로, 사실은 표로 — 한 카드 안에서 밴드가 위, 확정 정보 표가 아래다.
          리소스별 사실(연결 상태·실패 사유·Pod 로그)은 전부 표의 열이다. 지난 회차와
          결정은 밴드의 링크가 여는 모달로 — 탭의 마지막 절이 "과거"가 되지 않도록
          (사용자 화면 Step 5 와 같은 배치). */}
      <TcLatestRunCard
        latest={latest}
        status={status}
        buckets={buckets}
        credentialMissing={credentialMissing}
        credFilterOn={credMissingOnly}
        onToggleCredFilter={() => setCredMissingOnly((on) => !on)}
        loading={!statusLoaded}
        failed={latestFailed}
        statusFailed={statusFailed}
        statusLoaded={statusLoaded}
        running={running}
        triggering={triggering}
        triggerFailed={triggerFailed}
        onRunTest={() => void runTest()}
        onReloadStatus={onStatusReload}
        onOpenRunHistory={() => setRunHistoryOpen(true)}
        onOpenDecisionHistory={() => setHistoryOpen(true)}
        onOpenCredentials={() => setCredentialsOpen(true)}
      >
        <ConfirmedInfoCard
          targetSourceId={targetSourceId}
          isIdc={isIdc}
          rows={orderedRows}
          secrets={secrets}
          tcResults={statusLoaded ? results : []}
          facts={tcFactsByResource(statusLoaded ? latest : null)}
          credMissingOnly={credMissingOnly}
          loading={!settled}
          failed={confirmedFailed}
          onReload={reload}
        />
      </TcLatestRunCard>

      {runHistoryOpen && (
        <TcRunHistoryModal
          targetSourceId={targetSourceId}
          onClose={() => setRunHistoryOpen(false)}
        />
      )}

      {historyOpen && (
        <TcHistoryModal targetSourceId={targetSourceId} onClose={() => setHistoryOpen(false)} />
      )}

      {credentialsOpen && (
        <TcCredentialModal
          secrets={secrets}
          rows={orderedRows}
          failed={secretsFailed}
          onClose={() => setCredentialsOpen(false)}
        />
      )}
    </>
  );
}
