'use client';

/**
 * Target Source 운영 상세 (design-benchmark `ops-detail-ia-redesign.md` R1,
 * `ops-target-frontmeta.md` 시안 C) — masthead wash + attached card tabs over a
 * lavender canvas. The target's whole identity is one FrontMeta in the masthead
 * (OpsHeader), so the tab content owns the full content width: the 236px meta
 * rail folded into that header's 「상세 정보」 disclosure.
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
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import { ProcessCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ProcessCard';
import { ApprovalHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ApprovalHistoryCard';
import { StatusHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StatusHistoryCard';
import { InstallModeModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallModeModal';
import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';
import { RawDataModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RawDataModal';
import { DescriptionEditModal } from '@/app/services/_components/DescriptionEditModal';
import { type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { isSduTarget, normalizeCloudProvider, readSupportRawData } from '@/lib/types';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { SduOpsNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduOpsNotice';
import { ScanTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanTab';
import { RequestTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';
import { ConfirmTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab';
import { PipelineTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/PipelineTab';
import { TcTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab';
import { ApprovalTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ApprovalTab';
import { AirflowTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AirflowTab';
import { AppError } from '@/lib/errors';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getDagStatus } from '@/app/lib/api/ops';
import {
  TC_COMPLETED,
  tcRunGate,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { runStatus } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

type TabLabel = OpsTargetTabLabel;

/**
 * The render order, in three groups — 보기 · 실행 · 승인·근거. The strip draws one
 * hairline per group (`opsStyles.tabGroup`), so this array is what the segmentation
 * is made of, not a label on top of a flat list.
 *
 * **This is the only list of tabs.** The flat list the strip's selection logic needs
 * is derived from it (`tabGroups.flat()`), never written a second time: two lists
 * filtered by two copies of the same predicate agree only by luck, and the round
 * they stop agreeing, `currentTab` can name a tab that is not rendered — a panel
 * open under a strip with no active tab, and the URL-repair effect silent because
 * `currentTab === requestedTab`.
 *
 * Every OPS_TAB_SLUGS entry must appear in exactly one group. That is not a comment
 * anyone has to keep: `OpsTargetView.idc.test.tsx` compares a non-IDC target's strip
 * against `Object.values(OPS_TAB_SLUGS)`, so a slug added to `lib/routes.ts` and
 * left out of these rows fails there instead of quietly never rendering.
 *
 * Airflow 확인 (PR #783) landed at the end of the tool run, but it is not a tool:
 * it holds the evidence behind 승인 조건 ③ and is read, not operated.
 */
const TAB_GROUPS: readonly (readonly TabLabel[])[] = [
  [OPS_TAB_SLUGS.status, OPS_TAB_SLUGS.scan, OPS_TAB_SLUGS.request, OPS_TAB_SLUGS.confirm],
  [OPS_TAB_SLUGS.infra, OPS_TAB_SLUGS.tc],
  [OPS_TAB_SLUGS.approval, OPS_TAB_SLUGS.airflow],
];

/**
 * ProcessStatus → the tab that step is worked in. The second underline (보라) stands
 * on this tab: the first (파랑) says which panel is open, this one says where the
 * work currently sits, and the two are different questions.
 *
 * 1단계(IDLE)·7단계(COMPLETED) 는 **어느 탭에도 걸지 않는다**. 1단계는 담당자가 아직
 * 사용자 Step1 화면에서 DB 를 고르는 중이라 「스캔」도 「연동 요청 정보」도 이 콘솔의
 * 사실이 아니고, 7단계는 대응하는 탭 자체가 없다. 없는 자리를 가장 가까운 탭으로
 * 반올림하면 밑줄이 매번 거짓말을 한다.
 */
const STEP_TAB = new Map<ProcessStatus, TabLabel>([
  ['PENDING', OPS_TAB_SLUGS.request],
  ['CONFIRMING', OPS_TAB_SLUGS.confirm],
  ['CONFIRMED', OPS_TAB_SLUGS.infra],
  ['INSTALLED', OPS_TAB_SLUGS.tc],
  ['CONNECTED', OPS_TAB_SLUGS.approval],
]);

type ModalState =
  | { type: 'mode' }
  | { type: 'edit'; kind: RoleKind }
  | { type: 'raw' }
  | { type: 'description' }
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
  // 설치 모드와 같은 자리 — 표시값은 상세에서 오고, 저장 직후 한 번만 이 칸이 덮는다.
  // `undefined` 는 "응답에 값이 없다"이고, 헤더는 그것을 미확인으로 그린다.
  const [supportRawData, setSupportRawData] = useState<boolean | undefined>(undefined);
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
  /** status 조회가 '아직 없다'(404)가 아닌 이유로 거절됐는가 — 조회 실패 ≠ 미요청. */
  const [tcStatusFailed, setTcStatusFailed] = useState(false);
  // DAG 헬스는 한 자리에서 받는다 — 관리자 승인 탭의 조건 ③ 과 Airflow 확인 탭이 같은
  // 응답을 읽으므로, 탭을 오갈 때마다 같은 §10 을 다시 부르지 않게 소유자는 여기다.
  const [dag, setDag] = useState<DagFetch>({ phase: 'loading' });
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
  // IDC 분기는 **그룹 안에서** 일어난다 — 「스캔」이 빠져도 그룹은 셋 그대로고,
  // 보기 그룹만 넷에서 셋이 된다. 평평한 목록에서 걸러 낸 뒤 다시 묶으면 그룹이
  // 사라지는 경우를 따로 다뤄야 하는데, 이 화면에는 그런 경우가 없다.
  const tabGroups = isIdc
    ? TAB_GROUPS.map((group) => group.filter((tab) => tab !== OPS_TAB_SLUGS.scan))
    : TAB_GROUPS;
  // 평평한 목록은 **그린 것에서** 나온다 — 같은 술어를 두 번 적으면 두 목록이 우연히만
  // 일치하고, 어긋나는 순간 `currentTab` 이 렌더되지 않는 탭을 가리킬 수 있다.
  const tabs = tabGroups.flat();
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
    // NOT_FOUND 만 "아직 요청 전"이다 — 그 밖의 거절을 null 로 접으면 승인 조건 ① 이
    // 조회 실패를 '미요청'으로 단정한다 (fetchLatestTest 와 같은 규칙).
    setTcStatusFailed(
      statusRow.status === 'rejected'
      && !(statusRow.reason instanceof AppError && statusRow.reason.code === 'NOT_FOUND'),
    );
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
      setSupportRawData(readSupportRawData(loaded));

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

  /**
   * §10 dag-status — 한 대상의 응답이 MB 단위까지 간다(논리 DB 1만 행). 그래서 대상을
   * 열자마자가 아니라 **읽을 사람이 생겼을 때** 받는다:
   *   완료 승인된 대상   승인 조건 ③ 이 판정을 걸고 있다 (탭과 무관하게 필요)
   *   Airflow 확인 탭    본문 전체가 이 응답이다
   * 완료 승인된 대상에서는 이 값이 계속 true 라 승인 ↔ Airflow 를 오가도 deps 가 그대로다
   * — 탭 전환으로는 다시 부르지 않는다.
   */
  const needsDag = tcStatus?.status === TC_COMPLETED || currentTab === OPS_TAB_SLUGS.airflow;
  useAbortableEffect(
    (signal) => {
      if (!needsDag) return;
      setDag({ phase: 'loading' });
      return getDagStatus(targetSourceId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          setDag({ phase: 'loaded', data, fetchedAt: new Date().toISOString() });
        })
        .catch(() => {
          if (signal.aborted) return;
          setDag({ phase: 'failed' });
        });
    },
    [needsDag, targetSourceId, reloadKey],
  );

  /**
   * 「연결 테스트」 탭의 점 — 탭 줄에서 유일하게 상태를 말하는 자리다. 판정은 승인 탭과
   * 같은 게이트(`tcRunGate`)에서 나오고, 이미 이 화면이 들고 있는 세 응답만 읽는다 —
   * 탭 줄을 위한 요청은 없다.
   *
   * 말하는 것은 둘뿐이다: 최신 실행이 **실패**했거나 아직 **열려 있다**(PENDING·RUNNING).
   * 이력 없음·조회 실패·enum 밖은 점을 켜지 않는다 — 그것들은 "무엇이 있다"가 아니라
   * "모른다"라, 탭 옆의 점 하나로 말할 수 있는 사실이 아니다.
   */
  const tcGate = tcLoaded
    ? tcRunGate(runStatus(tcLatest), tcLatest !== null, tcLatestFailed)
    : 'loading';
  const tcDot =
    tcGate === 'failed'
      ? opsStyles.tabDotFail
      : tcGate === 'open'
        ? opsStyles.tabDotRunning
        : null;
  /**
   * 점이 말하는 것을 **낱말로도** 싣는다 — 점 자체는 `aria-hidden` 이라, 이 문장이
   * 없으면 「연결 테스트 실패」가 스크린 리더에 한 글자도 도착하지 않는다. 탭의
   * 접근명 뒤에 붙어서 "연결 테스트, 최근 실행 실패" 로 읽힌다.
   */
  const tcWord = tcGate === 'failed' ? '최근 실행 실패' : tcGate === 'open' ? '최근 실행 진행 중' : null;

  // 걸린 단계 — 1·7 단계는 STEP_TAB 에 없으므로 어느 탭도 코너 점을 켜지 않는다.
  const stepTab = processStatus ? STEP_TAB.get(processStatus) ?? null : null;
  const stepInfo = processStatus ? STEP[processStatus] : null;
  /**
   * 빨강은 6단계 하나에만 (오너 2026-08-27). 그 단계만 관리자가 실제로 막혀 있고,
   * 나머지는 다른 누군가의 차례이거나 파이프라인이 돌고 있는 중이다 — 걸렸다는 사실
   * 전체를 빨강으로 칠하면 모든 대상이 늘 어떤 단계엔가 있으므로 빨강이 상시 켜진다.
   * 낱말도 같이 갈린다: 빨강만 「확인 필요」라고 말한다.
   */
  const stepAlert = processStatus === 'CONNECTED';
  const stepDot = stepAlert ? opsStyles.tabCornerAlert : opsStyles.tabCornerStep;
  const stepWord = stepInfo
    ? `${stepAlert ? '확인 필요 — ' : '현재 '}${stepInfo.n}단계 · ${stepInfo.label}`
    : null;

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
    // 스켈레톤은 정착 프레임의 컨테이너 클래스를 그대로 쓴다 — 도착 시 마스트헤드·탭
    // 레일·본문 시작 y 가 움직이지 않게. 데이터에 따라 있고 없는 부분(StepPill·role
    // 행·탭 구성)은 그리지 않는다. h1 은 고정 텍스트라 실물로 그린다.
    return (
      <div className={opsStyles.page} aria-busy>
        <span className="sr-only">불러오는 중</span>
        <div className={opsStyles.masthead}>
          {/* 정착 프레임의 컨테이너 클래스를 그대로 쓴다 — 도착 시 마스트헤드·탭·
              본문 시작 y 가 움직이지 않게. 데이터에 따라 있고 없는 부분(StepPill·
              도장·탭 구성·레일 행)은 그리지 않는다. */}
          <div className={opsStyles.pathLine}>
            <div className={cn(opsStyles.skeletonWash, 'h-6 w-[320px]')} />
          </div>
          {/* 명명 블록 + kv 2행 — 셀 수는 데이터라 그리지 않고, 행 수만 잡는다:
              마스트헤드가 그만큼 자리를 비워 두면 도착해도 탭이 위아래로 안 뛴다. */}
          <div className={opsStyles.fmGroup}>
            <div className={opsStyles.fmHead}>
              {/* 22px — `fmLabel` 이 16px 이 되면서 그 줄 상자가 22.39px 가 됐다(실측).
                  20 으로 두면 스켈레톤 마스트헤드가 2.4px 짧아 도착하는 순간 탭 줄이
                  아래로 뛴다 — 이 자리가 잡아야 하는 바로 그것이다. */}
              <div className={cn(opsStyles.skeletonWash, 'h-[22px] w-[108px]')} />
            </div>
            <div className={opsStyles.fmGrid}>
              {[0, 1].map((row) => (
                <div key={row} className={cn(opsStyles.fmCell, 'col-span-4')}>
                  <div className={cn(opsStyles.skeletonWash, 'h-4 w-[64px]')} />
                  <div className={cn(opsStyles.skeletonWash, 'h-[22px] w-[180px]')} />
                </div>
              ))}
            </div>
          </div>
          {/* 아래 선은 `tabGroup` 이 아니라 스트립이 긋는다 — 구간이 몇 개이고 어디서
              끊기는지는 **탭 구성**, 곧 데이터다. 그룹 하나를 두르면 아래 선이 보이지 않는
              탭 하나의 폭(44px)만 덮어, 도착하는 순간 44px 토막이 세 도막 732px 로 뛴다.
              모르는 것을 지어내지 않고 통으로 긋는다: 띠는 도착 전에도 선 두 개 사이에 있고,
              바뀌는 것은 아래 선이 **끊기는 자리**뿐이다. */}
          <div className={cn(opsStyles.tabStrip, opsStyles.tabStripLoading)}>
            {/* 보이지 않는 탭 하나가 레일 높이를 정확히 잡는다. */}
            <span className={cn(opsStyles.tab, 'invisible select-none')} aria-hidden>
              탭
            </span>
          </div>
        </div>
        <div className={opsStyles.body}>
          <div className={opsStyles.content}>
            <div className={cn(opsStyles.skeleton, 'h-[320px]')} />
          </div>
        </div>
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
    <div className={opsStyles.page}>
      <div className={opsStyles.masthead}>
        <OpsHeader
          targetSourceId={targetSourceId}
          detail={detail}
          processStatus={processStatus}
          isAws={isAws}
          savedRoleArns={savedRoleArns}
          grantTfExecution={grantTfExecution}
          supportRawData={supportRawData}
          jiraTicket={jiraTicket}
          ticketLoaded={ticketLoaded}
          onOpenMode={() => setModal({ type: 'mode' })}
          onOpenEdit={(kind) => setModal({ type: 'edit', kind })}
          onOpenRawData={() => setModal({ type: 'raw' })}
          onEditDescription={() => setModal({ type: 'description' })}
        />
        <div className={opsStyles.tabStrip} role="tablist" aria-label="Target Source 운영 탭">
          {tabGroups.map((group) => (
            // 한 그룹 = 아래 헤어라인 한 도막. 그룹 사이 22px 에서 선이 끊긴다(실측).
            // `role="presentation"` — 그룹은 선을 긋는 상자일 뿐이라, tablist 가 소유하는
            // 것은 계속 탭 버튼이어야 한다.
            <div key={group[0]} role="presentation" className={opsStyles.tabGroup}>
              {group.map((tab) => {
                const active = tab === currentTab;
                const isStep = tab === stepTab;
                // 한 탭이 두 마크를 동시에 들 수 있다 — 라벨 옆 인라인 점은 「연결 테스트」의
                // 실행 결과, 우상단 코너 점은 걸린 단계다. 뜻이 다른 두 사실이라 자리로 갈린다.
                const words = [
                  tab === OPS_TAB_SLUGS.tc ? tcWord : null,
                  isStep ? stepWord : null,
                ].filter((word): word is string => word !== null);
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
                    {/* 낱말이 마크를 대신한다 — 점은 둘 다 aria-hidden 이라, 상태는 탭의
                        접근명에 실려야 스크린 리더에 도착한다. */}
                    {words.length > 0 && <span className="sr-only">, {words.join(', ')}</span>}
                    {tab === OPS_TAB_SLUGS.tc && (
                      <span
                        className={cn(opsStyles.tabDot, tcDot, tcDot ? 'opacity-100' : 'opacity-0')}
                        aria-hidden
                      />
                    )}
                    {isStep && (
                      // 흐름 밖이라 슬롯을 예약하지 않는다 — 늦게 도착해도 x 를 밀지 않는다.
                      //
                      // `title` 은 버튼이 아니라 **점**이 진다. 버튼에 두면 접근명(내용 =
                      // 위 `.sr-only` 포함)과 접근설명(title)이 같은 문장이 되어 스크린
                      // 리더가 두 번 읽는다. 점은 `aria-hidden` 이라 a11y 트리 밖이고,
                      // 마우스 툴팁만 남는다 — 낱말 쪽은 그대로 둔다(⛔ title 은 낭독이
                      // 보장되지 않으므로 `.sr-only` 를 title 로 대체할 수 없다).
                      <span
                        className={cn(opsStyles.tabCorner, stepDot)}
                        title={stepWord ?? undefined}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={opsStyles.body}>
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
          {currentTab === '확정 정보' && (
            <ConfirmTab
              targetSourceId={targetSourceId}
              detail={detail}
              processStatus={processStatus}
              onOpenInfra={() => selectTab('인프라 작업')}
            />
          )}
          {currentTab === '인프라 작업' && (
            <PipelineTab
              targetSourceId={targetSourceId}
              detail={detail}
              processStatus={processStatus}
              onSelectTab={selectTab}
            />
          )}
          {currentTab === '연결 테스트' && (
            <TcTab
              targetSourceId={targetSourceId}
              isIdc={isIdc}
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
              latest={tcLatest}
              latestFailed={tcLatestFailed}
              tcLoaded={tcLoaded}
              statusFailed={tcStatusFailed}
              results={tcResults}
              dag={dag}
              onDecided={retry}
              onOpenTcTab={() => selectTab('연결 테스트')}
              onOpenAirflowTab={() => selectTab('Airflow 확인')}
            />
          )}
          {currentTab === 'Airflow 확인' && (
            <AirflowTab targetSourceId={targetSourceId} isIdc={isIdc} dag={dag} />
          )}
        </div>
      </div>

      {modal?.type === 'description' && (
        <DescriptionEditModal
          targetSourceId={targetSourceId}
          initialDescription={detail.description ?? ''}
          // 저장값으로 detail 한 칸만 갱신 — 설치모드·실데이터와 같은 로컬 1칸 수법.
          onSaved={(saved) => {
            setDetail((d) => (d ? { ...d, description: saved } : d));
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      <RawDataModal
        open={modal?.type === 'raw'}
        onClose={() => setModal(null)}
        targetSourceId={targetSourceId}
        current={supportRawData}
        onSaved={setSupportRawData}
      />
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
