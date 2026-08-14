'use client';

/**
 * Target Source 운영 상세 (Figma pYCA7zTWcZysYOpYykuYAN 4:2) — header + tab
 * shell + 진행 상태 tab. Other tabs are visible but disabled until their
 * contents ship (design/pipeline/ops-target-source-app-plan.md §1).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import {
  OPS_TAB_SLUGS,
  opsTabLabel,
  opsTabSlug,
  type OpsTargetTabLabel,
} from '@/lib/routes';
import { getRawTargetSourceDetail, type RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { getProcessStatus, type TestConnectionVersionResult } from '@/app/lib/api';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import { getTargetJiraTicket, type TargetJiraTicket } from '@/app/lib/api/ops';
import {
  getTestConnectionDetail,
  getTestConnectionResults,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { tcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import { ProcessCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ProcessCard';
import { ApprovalHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ApprovalHistoryCard';
import { StatusHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StatusHistoryCard';
import { InstallModeModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallModeModal';
import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';
import { type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { isSduTarget, normalizeCloudProvider } from '@/lib/types';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { SduOpsNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduOpsNotice';
import { ScanTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanTab';
import { RequestTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';
import { PipelineTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/PipelineTab';
import { TcTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab';
import { ApprovalTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ApprovalTab';

const TABS = Object.values(OPS_TAB_SLUGS);
type TabLabel = OpsTargetTabLabel;

type ModalState =
  | { type: 'mode' }
  | { type: 'edit'; kind: RoleKind }
  | null;

export interface OpsTargetViewProps {
  targetSourceId: number;
  /** Tab from the `?tab=` deep link (server-resolved; defaults to 진행 상태). */
  initialTab: TabLabel;
}

export function OpsTargetView({ targetSourceId, initialTab }: OpsTargetViewProps): ReactElement {
  const [detail, setDetail] = useState<RawTargetSourceDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  // 방금 저장한 ARN만 담는다 — 표시값의 출처는 detail.metadata 이고, 저장 직후에는
  // 그 detail 이 아직 옛 값이라 이 한 칸이 덮어쓴다 (다음 로드에서 metadata 가 따라온다).
  const [savedRoleArns, setSavedRoleArns] = useState<Partial<Record<RoleKind, string>>>({});
  const [grantTfExecution, setGrantTfExecution] = useState(false);
  const [jiraTicket, setJiraTicket] = useState<TargetJiraTicket | null>(null);
  // 티켓은 detail 과 따로 도착한다 — 도착 전에 "연결된 티켓 없음" 을 그리면 곧바로
  // 티켓으로 뒤집히므로, 그 사이는 없다고 말하지 않고 자리만 비워 둔다.
  const [ticketLoaded, setTicketLoaded] = useState(false);
  // Test Connection state lives here, not in TcTab: 관리자 승인 탭도 같은 상태·판정
  // 위에서 결정을 내리므로, 한 번 받아 두 탭에 내려보낸다.
  //   status   서비스의 완료 확인 (승인 게이트)
  //   latest   최신 실행 — 회차·상태·시각 + 리소스별 판정 (404 = 실행 없음 → null)
  //   results  리소스별 논리 DB 건수 (최신 성공 실행에만 존재)
  const [tcStatus, setTcStatus] = useState<TestConnectionStatusRow | null>(null);
  const [tcLatest, setTcLatest] = useState<TestConnectionVersionResult | null>(null);
  const [tcResults, setTcResults] = useState<TcResultRow[]>([]);
  const [tcLoaded, setTcLoaded] = useState(false);
  const [tcLatestFailed, setTcLatestFailed] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  /**
   * The tab the URL asks for — not necessarily the one on screen. A target whose tab
   * list is short a tab (IDC, below) renders `currentTab` instead, so read that one
   * for anything that means "what the operator is looking at".
   */
  const [requestedTab, setRequestedTab] = useState<TabLabel>(initialTab);

  // The URL is kept in sync so a tab is linkable/shareable and survives reload.
  // history.replaceState (not router.replace) because switching a tab is not a
  // navigation: no server round trip, no history entry, no scroll reset. Next
  // supports this and useSearchParams stays consistent.
  const writeTabUrl = useCallback((tab: TabLabel) => {
    const slug = opsTabSlug(tab);
    window.history.replaceState(
      null,
      '',
      slug === 'status' ? window.location.pathname : `${window.location.pathname}?tab=${slug}`,
    );
  }, []);

  const selectTab = useCallback(
    (tab: TabLabel) => {
      setRequestedTab(tab);
      writeTabUrl(tab);
    },
    [writeTabUrl],
  );

  // Back/forward restores the tab the URL points at.
  useEffect(() => {
    const onPop = (): void =>
      setRequestedTab(opsTabLabel(new URLSearchParams(window.location.search).get('tab') ?? undefined));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /**
   * IDC targets have no 스캔 tab — scanning walks a CSP account for candidates, and an
   * IDC target is registered by hand, so there is no account to walk. Unlike SDU this
   * drops one tab rather than the whole screen; every other tab still applies.
   *
   * Normalized, not compared raw: the contract types cloud_provider as a plain string
   * (install-v1 `Str`), so casing is not guaranteed, and the ScanTab this hides reads
   * the same field the same way. An unknown value normalizes to AWS and keeps the tab.
   *
   * Sits above the loading / SDU early returns so the effect below can join the other
   * hooks; `detail` is null on the first render, which just leaves every tab in place.
   */
  const isIdc = detail != null && normalizeCloudProvider(detail.cloud_provider) === 'IDC';
  const tabs = isIdc ? TABS.filter((tab) => tab !== OPS_TAB_SLUGS.scan) : TABS;
  const currentTab = tabs.includes(requestedTab) ? requestedTab : tabs[0];

  // A `?tab=scan` link to an IDC target — a bookmark from before the tab was dropped,
  // or an AWS link with the id swapped — renders 진행 상태. Rewrite the URL to match,
  // or reload and re-share keep pointing at a tab that is not on the screen. Only the
  // URL moves: `currentTab` already renders the right panel, so correcting the state
  // too would just be a second render for the same result.
  useEffect(() => {
    if (currentTab !== requestedTab) writeTabUrl(currentTab);
  }, [currentTab, requestedTab, writeTabUrl]);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  // TC 전용 새로고침 — 실행 중 폴링이 이걸 4초마다 부르므로, 페이지 전체(detail·process·
  // channel·role) 를 다시 받지 않고 TC 세 건만 다시 받는다. Latest-request-wins: 대상이
  // 바뀌거나 폴링이 겹쳐도 오래된 응답이 새 응답을 덮지 않는다.
  const tcSeq = useRef(0);
  const loadTc = useCallback(async (): Promise<void> => {
    const seq = ++tcSeq.current;
    const [statusRow, latest, resultRows] = await Promise.allSettled([
      getTestConnectionDetail(targetSourceId),
      // 404 = 연결 테스트 이력 없음 → null (오류가 아니다).
      fetchLatestTest(targetSourceId),
      getTestConnectionResults(targetSourceId),
    ]);
    if (seq !== tcSeq.current) return;
    setTcStatus(statusRow.status === 'fulfilled' ? statusRow.value : null);
    setTcLatest(latest.status === 'fulfilled' ? latest.value : null);
    setTcLatestFailed(latest.status !== 'fulfilled');
    setTcResults(resultRows.status === 'fulfilled' ? resultRows.value : []);
    setTcLoaded(true);
  }, [targetSourceId]);
  // Stable identity — TcTab's poll interval depends on it, so a fresh arrow per
  // render would tear down and restart the interval on every state change.
  const reloadTc = useCallback((): void => {
    void loadTc();
  }, [loadTc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: RawTargetSourceDetail;
      try {
        loaded = await getRawTargetSourceDetail(targetSourceId);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setDetailFailed(true);
        }
        return;
      }
      if (cancelled) return;
      setDetailFailed(false);
      setDetail(loaded);
      setGrantTfExecution(loaded.metadata?.grant_service_terraform_execution_permission === true);

      // SDU 는 여기서 멈춘다. 아래 부수 로드는 전부 탭이 그릴 것을 미리 받아 두는
      // 것인데, SDU 는 그 탭들이 통째로 안내 한 장으로 대체되므로 받아도 그릴 곳이
      // 없다. 진행 상태·Jira 티켓·연결 테스트·AWS role 네 갈래가 대상마다 헛돈다.
      // 판정은 렌더 게이트와 같은 규칙이다 (계약이 SDU 를 말하는 두 자리).
      if (isSduTarget({ is_sdu_type: loaded.metadata?.is_sdu_type, cloud_provider: loaded.cloud_provider })) {
        return;
      }

      // Secondary loads are independent and best-effort — each block renders its
      // own fallback, so one failure must not blank the page.
      void getProcessStatus(targetSourceId)
        .then((status) => !cancelled && setProcessStatus(status.process_status as ProcessStatus))
        .catch(() => !cancelled && setProcessStatus(null));
      void getTargetJiraTicket(targetSourceId)
        .then((loaded) => !cancelled && setJiraTicket(loaded))
        .catch(() => !cancelled && setJiraTicket(null))
        .finally(() => !cancelled && setTicketLoaded(true));
      void loadTc();
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey, loadTc]);

  if (detailFailed) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
        <p>Target Source #{targetSourceId} 정보를 불러오지 못했습니다.</p>
        <PlButton variant="secondary" className="mt-3" onClick={retry}>
          다시 시도
        </PlButton>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)} aria-busy>
        불러오는 중…
      </div>
    );
  }

  const meta = detail.metadata ?? {};

  /**
   * SDU 는 여기서 끊는다 — 아래 탭들이 마운트되기 전에.
   *
   * 스캔·연동 요청·설치 상태는 전부 "우리가 설치하는 계정"을 전제로 만든 화면인데,
   * SDU 는 담당자가 데이터를 직접 올리는 대상이라 그 전제가 성립하지 않는다. 탭을
   * 남겨 두면 눌러서 빈 화면을 여는 것이 동작처럼 보이고, 그 안에서 각 탭이 제 몫의
   * 요청을 쏘고 나서야 할 말이 없다는 걸 알게 된다.
   *
   * 계약이 SDU 를 말하는 두 자리를 모두 본다 — metadata.is_sdu_type 과 cloudProvider
   * enum 의 SDU. 플래그만 보면 provider 로 SDU 가 오는 대상이 이 게이트를 통과한다.
   */
  if (isSduTarget({ is_sdu_type: meta.is_sdu_type, cloud_provider: detail.cloud_provider })) {
    return (
      <SduOpsNotice
        targetSourceId={targetSourceId}
        serviceName={detail.service_name ?? '-'}
        serviceCode={detail.service_code ?? null}
        isChinaRegion={meta.is_china_region === true}
      />
    );
  }

  const isAws = detail.cloud_provider === 'AWS';
  const accountId = meta.aws_account_id ?? '';
  const isChina = meta.is_china_region === true;
  const regionLabel = isChina ? 'China' : 'Global';
  const activeRole = modal?.type === 'edit' ? modal.kind : null;

  return (
    <div>
      <div className={opsStyles.headCard}>
        <OpsHeader
          targetSourceId={targetSourceId}
          detail={detail}
          processStatus={processStatus}
          isAws={isAws}
          savedRoleArns={savedRoleArns}
          grantTfExecution={grantTfExecution}
          jiraTicket={jiraTicket}
          ticketLoaded={ticketLoaded}
          onOpenMode={() => setModal({ type: 'mode' })}
          onOpenEdit={(kind) => setModal({ type: 'edit', kind })}
        />
        <div className={opsStyles.tabStrip} role="tablist" aria-label="Target Source 운영 탭">
          {tabs.map((tab) => {
            const active = tab === currentTab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(tab)}
                className={cn(opsStyles.tab, active ? opsStyles.tabActive : opsStyles.tabIdle)}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className={opsStyles.content}>
        {currentTab === '진행 상태' && (
          <>
            {processStatus ? (
              <ProcessCard status={processStatus} />
            ) : (
              <section className={pipelineStyles.card.base} aria-label="현재 Process">
                <h2 className={opsStyles.cardTitle}>현재 Process</h2>
                <p className={cn(pipelineStyles.text.meta, 'mt-3')}>상태 정보를 불러오지 못했습니다.</p>
              </section>
            )}
            <div className={opsStyles.cardsRow}>
              <ApprovalHistoryCard targetSourceId={targetSourceId} isIdc={isIdc} />
              <StatusHistoryCard targetSourceId={targetSourceId} />
            </div>
          </>
        )}
        {currentTab === '스캔' && (
          <ScanTab
            targetSourceId={targetSourceId}
            detail={detail}
            // This screen owns the modal the permission card's CTA opens. The
            // register/edit contract is AWS-only, so no other provider gets it.
            onEditRole={isAws ? (kind) => setModal({ type: 'edit', kind }) : undefined}
            credentialReloadKey={savedRoleArns.scan}
          />
        )}
        {currentTab === '연동 요청 정보' && <RequestTab targetSourceId={targetSourceId} detail={detail} />}
        {currentTab === '인프라 작업' && (
          <PipelineTab
            targetSourceId={targetSourceId}
            detail={detail}
            onOpenRequest={() => selectTab('연동 요청 정보')}
          />
        )}
        {currentTab === 'Test Connection' && (
          <TcTab
            targetSourceId={targetSourceId}
            isIdc={isIdc}
            status={tcStatus}
            latest={tcLatest}
            results={tcResults}
            statusLoaded={tcLoaded}
            latestFailed={tcLatestFailed}
            onStatusReload={reloadTc}
          />
        )}
        {currentTab === '관리자 승인' && (
          <ApprovalTab
            targetSourceId={targetSourceId}
            detail={detail}
            status={tcStatus}
            stats={tcResultStats(tcResults, tcLatest)}
            onDecided={retry}
          />
        )}
      </div>

      <InstallModeModal
        open={modal?.type === 'mode'}
        onClose={() => setModal(null)}
        targetSourceId={targetSourceId}
        currentGrant={grantTfExecution}
        onSaved={setGrantTfExecution}
      />
      {activeRole && modal?.type === 'edit' && (
        <RoleEditModal
          open
          onClose={() => setModal(null)}
          targetSourceId={targetSourceId}
          kind={activeRole}
          // OpsHeader 의 표시 폴백과 같은 순서 — 빈 입력으로 열리면 덮어쓰기 사고가 된다.
          currentArn={
            savedRoleArns[activeRole]
            ?? (activeRole === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn)
            ?? undefined
          }
          accountId={accountId}
          isChinaRegion={isChina}
          regionLabel={regionLabel}
          onSaved={(kind, roleArn) => setSavedRoleArns((prev) => ({ ...prev, [kind]: roleArn }))}
        />
      )}
    </div>
  );
}
