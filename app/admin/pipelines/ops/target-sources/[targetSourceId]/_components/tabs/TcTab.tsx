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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  getConfirmedIntegration,
  getSecrets,
  triggerTestConnection,
  updateTestConnectionConfirmation,
  type ConfirmedIntegrationResourceItem,
  type TestConnectionVersionResult,
} from '@/app/lib/api';
import { useApiAction } from '@/app/hooks/useApiMutation';
import type { SecretKey } from '@/lib/types';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { TcLatestRunCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard';
import { TcRunHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcRunHistoryModal';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';
import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';
import { StepHoldGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/StepHoldGate';
import { TcRequestApprovalModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcActionModals';
import { stepHoldView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';
import {
  bandBuckets,
  bandUnitIds,
  credentialMissingCount,
  isRunOpen,
  tcFactsByResource,
  toConfirmedUnits,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import { useInstallPending } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/useInstallCheck';
import {
  InstallPendingNotice,
  type InstallPendingNoticeData,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallPendingNotice';
import { InstallPendingConfirmModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallPendingConfirmModal';

/** Same cadence as the user-side Step 5 poll (useTestConnectionPolling). */
const POLL_MS = 4_000;

export interface TcTabProps {
  targetSourceId: number;
  /** Picks 확정 정보's identity columns — an IDC row has an address, not a name/region. */
  isIdc: boolean;
  /**
   * Already normalized by the screen (`pipelineProviderKey`). 설치 상태를 어느 계약에서
   * 읽을지가 이 값으로 갈리고, 'sdu' 는 읽을 설치 상태가 없어 아무것도 조회하지 않는다.
   */
  provider: string;
  /** AWS only — 설치 단계 이름이 설치 모드로 갈린다 (`isManualInstall`). */
  manualInstall: boolean;
  /** 최신 실행 (latest_version) — 실행 이력이 없으면 null. Fetched by the page. */
  latest: TestConnectionVersionResult | null;
  /** 리소스별 논리 DB 건수 (latest-results) — fetched by the page. */
  results: readonly TcResultRow[];
  /** Page-level TC fetch has settled at least once. */
  statusLoaded: boolean;
  /** latest_version 조회가 404 가 아닌 이유로 실패했다. */
  latestFailed: boolean;
  /**
   * 5단계 종료 조건이 읽는 둘 — 단계와 서비스의 승인 요청 상태. 승인 탭 조건 ①·② 와
   * 같은 값이라 페이지가 한 번 받아 두 탭에 내려보낸다. 단계가 5가 아니면 아무것도 서지 않는다.
   */
  processStatus: ProcessStatus | null;
  tcStatus: TestConnectionStatusRow | null;
  /** status 조회가 404 가 아닌 이유로 거절됐다 — 조회 실패 ≠ 미요청. */
  tcStatusFailed: boolean;
  /** Reload the page-level TC fetch (status + latest + results). */
  onStatusReload: () => void;
  /**
   * 관리자가 대신 보낸 승인 요청이 성공했다 — 단계가 5→6 으로 넘어가므로 페이지가 상세와
   * 단계를 다시 읽는다(승인 탭의 `onDecided` 와 같은 자리).
   */
  onAcknowledged: () => void;
}

export function TcTab({
  targetSourceId,
  isIdc,
  provider,
  manualInstall,
  latest,
  results,
  statusLoaded,
  latestFailed,
  processStatus,
  tcStatus,
  tcStatusFailed,
  onStatusReload,
  onAcknowledged,
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
      // and vice versa.
      const [confirmed, secretList] = await Promise.allSettled([
        getConfirmedIntegration(targetSourceId),
        getSecrets(targetSourceId),
      ]);
      if (cancelled) return;
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
  // The progress denominator counts what the test reports on, not what the table lists:
  // one Athena region is one result no matter how many databases it holds. Counting rows
  // here would print 진행 5/7 on a run that only ever produces five results — the same
  // miscount the user-side Step 5 card documents (ConnectionTestCard's TestUnit).
  const units = toConfirmedUnits(confirmedRows);
  // 밴드의 분모이자 무보고를 셀 수 있게 하는 집합. 확정 조회가 404·실패면 실행이 실제로
  // 보고한 id 로 떨어진다 — 빈 목록이면 `ok === total` 이 저절로 성립해 아무것도 확인하지
  // 않은 실행을 "모두 성공"이라 부르게 된다.
  const buckets = bandBuckets(bandUnitIds(units, latest), latest);
  const credentialMissing = settled ? credentialMissingCount(units) : 0;

  const running = isRunOpen(latest);

  // 「왜 아직 5단계인가」 — 두 행의 판정. 입력은 전부 이 탭이 이미 받는 값이다.
  const holdView = stepHoldView({
    processStatus,
    isSdu: provider === 'sdu',
    statusLoaded,
    tcStatus,
    tcStatusFailed,
    latest,
    latestFailed,
    buckets,
  });

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
  // 설치는 이 탭 밖에서 진행되므로, 실행이 정착하는 그 순간이 이 화면이 설치 상태를 다시
  // 물을 유일한 계기다(폴링은 없다 — 이 탭은 설치를 지켜보는 화면이 아니다).
  const installPendingState = useInstallPending(targetSourceId, provider, manualInstall);
  const installReload = installPendingState.reload;

  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      reload();
      onStatusReload();
      installReload();
    }
    wasRunning.current = running;
  }, [running, reload, onStatusReload, installReload]);

  const installPending = installPendingState.pending;
  // 카드까지 내려가는 한 묶음 — 그릴지 말지는 상자가 정한다(`startGate` 와 같은 길).
  const installPendingNotice = useMemo<InstallPendingNoticeData | null>(
    () =>
      installPending === null
        ? null
        : { result: installPending, lastCheck: installPendingState.lastCheck },
    [installPending, installPendingState.lastCheck],
  );

  // 마지막 하나를 배정하면 경고 줄이 사라진다 — 필터를 그대로 두면 표가 빈 화면이 되고,
  // 그것을 되돌릴 컨트롤(경고 줄의 토글)도 같이 사라진 뒤다. 사라질 때 같이 푼다.
  if (credMissingOnly && credentialMissing === 0) setCredMissingOnly(false);

  const [triggering, setTriggering] = useState(false);
  const [triggerFailed, setTriggerFailed] = useState(false);
  const [pendingConfirmOpen, setPendingConfirmOpen] = useState(false);
  // The server owns eligibility (409 while running / 4xx before install), so this
  // just reports; the button is disabled while a run is open to spare a request
  // that can only be refused.
  const startRun = useCallback(async (): Promise<void> => {
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

  /**
   * 단추가 부르는 것. 두 게이트가 순서를 갖는다:
   *
   *   Credential 미설정  잠금이다 — 여기서 끝난다(단추도 이미 `blocked` 라 대개 못 온다).
   *   설치 미완료        예보다 — 확인 한 겹을 세우고 판단은 운영자에게 넘긴다.
   *
   * `unknown`·`done` 은 아무것도 세우지 않는다: 못 읽은 것을 근거로 한 겹을 더 두면 그
   * 확인은 곧 의미 없는 관문이 되고, 진짜 예보일 때의 무게까지 같이 깎는다.
   */
  // 관리자가 서비스 담당자를 대신해 승인 요청을 보낸다 — 서비스 화면의 같은 PUT. 성공하면
  // 단계가 넘어가므로 TC 상태와 페이지 단계를 함께 다시 읽는다.
  const [requestOpen, setRequestOpen] = useState(false);
  const requestApproval = useApiAction(() => updateTestConnectionConfirmation(targetSourceId, true), {
    onSuccess: () => {
      setRequestOpen(false);
      toast.show('승인 요청을 보냈습니다.');
      onStatusReload();
      onAcknowledged();
    },
    onError: () => toast.show('승인 요청을 보내지 못했습니다.'),
  });

  const runTest = useCallback((): void => {
    if (credentialMissing > 0) return;
    if (installPending?.kind === 'needed') {
      setPendingConfirmOpen(true);
      return;
    }
    void startRun();
  }, [credentialMissing, installPending, startRun]);

  return (
    <>
      {/* 집계는 밴드로, 사실은 표로 — 한 카드 안에서 밴드가 위, 확정 정보 표가 아래다.
          리소스별 사실(연결 상태·실패 사유·Pod 로그)은 전부 표의 열이다. 지난 회차와
          결정은 밴드의 링크가 여는 모달로 — 탭의 마지막 절이 "과거"가 되지 않도록
          (사용자 화면 Step 5 와 같은 배치). */}
      <TcLatestRunCard
        latest={latest}
        buckets={buckets}
        credentialMissing={credentialMissing}
        credFilterOn={credMissingOnly}
        onToggleCredFilter={() => setCredMissingOnly((on) => !on)}
        loading={!statusLoaded}
        failed={latestFailed}
        running={running}
        triggering={triggering}
        triggerFailed={triggerFailed}
        onRunTest={runTest}
        onOpenRunHistory={() => setRunHistoryOpen(true)}
        onOpenDecisionHistory={() => setHistoryOpen(true)}
        onOpenCredentials={() => setCredentialsOpen(true)}
        installPendingSlot={
          <InstallPendingNotice data={installPendingNotice} className="mt-4" />
        }
        stepHoldSlot={
          <StepHoldGate
            view={holdView}
            onRequestApproval={() => setRequestOpen(true)}
            requesting={requestApproval.loading}
            className="mt-4"
          />
        }
      >
        <ConfirmedInfoCard
          targetSourceId={targetSourceId}
          isIdc={isIdc}
          rows={confirmedRows}
          secrets={secrets}
          tcResults={statusLoaded ? results : []}
          facts={tcFactsByResource(statusLoaded ? latest : null)}
          tcLoading={!statusLoaded}
          credMissingOnly={credMissingOnly}
          loading={!settled}
          failed={confirmedFailed}
          onReload={reload}
        />
      </TcLatestRunCard>

      {pendingConfirmOpen && installPending?.kind === 'needed' && (
        <InstallPendingConfirmModal
          result={installPending}
          triggering={triggering}
          onConfirm={() => {
            void startRun().finally(() => setPendingConfirmOpen(false));
          }}
          onClose={() => setPendingConfirmOpen(false)}
        />
      )}

      {requestOpen && (
        <TcRequestApprovalModal
          open
          targetSourceId={targetSourceId}
          onSubmit={() => void requestApproval.execute()}
          submitting={requestApproval.loading}
          onClose={() => setRequestOpen(false)}
        />
      )}

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
          rows={confirmedRows}
          // 이 모달을 여는 CTA 는 상태 조회(`statusLoaded`)에 걸려 있고 목록은 이 탭의
          // 별도 조회라, 상태가 먼저 도착한 창에서는 목록이 아직 없다. 그 창을 빈 목록으로
          // 그리지 않게 여기서 말해 준다.
          loading={!settled}
          failed={secretsFailed}
          onClose={() => setCredentialsOpen(false)}
        />
      )}
    </>
  );
}
