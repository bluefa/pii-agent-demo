'use client';

/**
 * Target Source 운영 상세 (design-benchmark `ops-detail-ia-redesign.md` R1,
 * `ops-target-frontmeta.md` 시안 C) — masthead wash + attached card tabs over a
 * lavender canvas. The target's whole identity is one FrontMeta in the masthead
 * (OpsHeader), so the tab content owns the full content width: the 236px meta
 * rail folded into that header's 「상세 정보」 disclosure.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
import { type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import { ApprovalHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ApprovalHistoryCard';
import { InstallModeModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallModeModal';
import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';
import { RawDataModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RawDataModal';
import { DescriptionEditModal } from '@/app/services/_components/DescriptionEditModal';
import { type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { isSduTarget, normalizeCloudProvider, readSupportRawData } from '@/lib/types';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { SduDefinitionCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduDefinitionCard';
import { SduAckCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduAckCard';
import { SduRecipientsCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduRecipientsCard';
import { OpsTabNavContext } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/StatusRowActions';
import { ScanTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanTab';
import { RequestTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';
import { ConfirmTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab';
import {
  PipelineTab,
  isManualInstall,
  pipelineProviderKey,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/PipelineTab';
import { TcTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab';
import { ApprovalTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ApprovalTab';
import { AirflowTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AirflowTab';
import { DangerTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DangerTab';
import { AppError } from '@/lib/errors';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useLocale } from '@/app/components/LocaleProvider';
import { COPY } from '@/lib/copy';
import { getDagStatus } from '@/app/lib/api/ops';
import { type DagFetch } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

type TabLabel = OpsTargetTabLabel;

/**
 * The render order, in four groups — 보기 · 실행 · 승인·근거 · 초기화. `opsStyles.tabGroup`
 * is a flex box that gives each group equal width; this array is what the grouping
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
 *
 * 연동 초기화 stands alone in the last group: it undoes the whole run rather than
 * moving it along, and the strip's own hairline is what keeps it off the end of the
 * approval group, where it would read as one more step of the same errand.
 */
const TAB_GROUPS: readonly (readonly TabLabel[])[] = [
  [OPS_TAB_SLUGS.status, OPS_TAB_SLUGS.scan, OPS_TAB_SLUGS.request, OPS_TAB_SLUGS.confirm],
  [OPS_TAB_SLUGS.infra, OPS_TAB_SLUGS.tc],
  [OPS_TAB_SLUGS.approval, OPS_TAB_SLUGS.airflow],
  [OPS_TAB_SLUGS.danger],
];

/**
 * 그룹이 탭 줄에서 가져가는 몫 = 그 그룹이 든 탭 수. 그래야 넷·둘·둘·하나로 갈린 그룹을
 * 지나도 아홉 셀의 폭이 서로 같다.
 *
 * 리터럴 표다 — 인라인 `style` 객체는 렌더마다 새로 만들어지고(AP-E2), 클래스 문자열은
 * 완전한 리터럴이어야 한다(동적 조합 금지). 값의 범위는 데이터가 정하지만 **유한하다**:
 * `TAB_GROUPS` 의 그룹은 넷·둘·둘·하나이고, IDC 가 「스캔」을 빼면 첫 그룹만 셋이 된다.
 *
 * 표가 아니라 **튜플**인 것이 요점이다. 키 있는 객체로 두면 범위 밖의 길이가 `undefined`
 * 를 돌려주고, `cn` 이 그걸 삼켜 그룹은 `flex-grow: 0` + `basis-0` 으로 **폭 0** 이 된다 —
 * 탭이 통째로 넘치는데 화면은 아무 말도 하지 않는다. 클램프해 두면 최악이 "폭이 조금
 * 좁다"로 끝난다. 슬러그가 어느 그룹에도 없는 경우는 `OpsTargetView.idc.test.tsx` 가
 * 이미 그 자리에서 깨뜨린다(`TAB_GROUPS` 주석 참조).
 */
const GROUP_GROW = ['grow', 'grow-[2]', 'grow-[3]', 'grow-[4]'] as const;
const growOf = (n: number) => GROUP_GROW[Math.min(Math.max(n, 1), GROUP_GROW.length) - 1];

/**
 * ProcessStatus → the tab that step is worked in. That tab carries the visible
 * 「현재 단계」 label next to its name; the active underline (파랑) says which panel
 * is open, this label says where the work currently sits — two different questions.
 *
 * 1단계(IDLE) 는 「스캔」에 건다 (오너 2026-09-11). IDC 는 스캔 탭이 없으므로 그때는
 * 어느 탭에도 서지 않는다 — 다른 탭으로 옮겨 걸지 않는다. SDU 의 2단계도 같다:
 * 「연동 요청 정보」 탭이 없으면 라벨은 서지 않는다.
 * 7단계(COMPLETED) 는 **어느 탭에도 걸지 않는다** — 대응하는 탭 자체가 없다.
 */
const STEP_TAB = new Map<ProcessStatus, TabLabel>([
  ['IDLE', OPS_TAB_SLUGS.scan],
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
  /**
   * 연동 현황 카드 — **서버가 그려서 내려보낸 엘리먼트**다 (`page.tsx` 의 `Suspense`
   * 슬롯). 이 뷰는 자리에 놓기만 하고 아무것도 조회하지 않는다. 함수 prop 이 아니라
   * 완성된 노드인 이유는 Server Component 를 client 경계 너머로 건네는 방법이 이것뿐
   * 이기 때문이다 — 그 안의 「상세보기」 버튼은 아래 `OpsTabNavContext` 로 이 뷰의
   * `selectTab` 을 꺼내 쓴다.
   */
  statusSlot: ReactNode;
}

export function OpsTargetView({ targetSourceId, initialTab, statusSlot }: OpsTargetViewProps): ReactElement {
  const { locale } = useLocale();
  const [detail, setDetail] = useState<RawTargetSourceDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  // 단계는 상세와 따로 도착한다 — 도착 전의 null 을 「단계 없음」으로 그리면 마스트헤드가
  // 알약 없이 한 번 서고, 알약이 끼어들며 그 오른쪽을 민다 (OpsHeader 의 seat).
  const [processLoaded, setProcessLoaded] = useState(false);
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
   * SDU 판정이 **먼저** 온다 — 아래 `isIdc` 가 이것을 읽는다.
   *
   * 계약이 SDU 를 말하는 두 자리를 모두 본다 — `metadata.is_sdu_type` 과 `cloud_provider`
   * enum 의 `SDU`. 프로바이더만 비교하면 절대 안 된다: SDU 는 `CloudProvider` 가 아니라
   * `normalizeCloudProvider` 가 'AWS' 로 접는다.
   *
   * 훅 뒤·로딩 조기 반환 위에 선다 — 탭 구성이 이것을 읽고, `detail` 은 첫 렌더에서 null
   * 이라 그때는 어느 탭도 빠지지 않는다.
   */
  const isSdu =
    detail != null
    && isSduTarget({ is_sdu_type: detail.metadata?.is_sdu_type, cloud_provider: detail.cloud_provider });
  /**
   * IDC targets have no 스캔 tab — scanning walks a CSP account for candidates, and an
   * IDC target is registered by hand, so there is no account to walk. Every other tab
   * still applies.
   *
   * Normalized, not compared raw: the contract types cloud_provider as a plain string
   * (install-v1 `Str`), so casing is not guaranteed, and the ScanTab this hides reads
   * the same field the same way. An unknown value normalizes to AWS and keeps the tab.
   *
   * **SDU 가 밑에 깔린 CSP 를 이긴다** — 이 화면이 `isAws` 를 쓰는 방식과 같다. 둘을 따로
   * 재면 `is_sdu_type: true` + `cloud_provider: 'IDC'` 인 대상이 두 필터를 모두 맞아 일곱
   * 탭으로 떨어지고, 스캔 탭이 통째로 사라져 수신자 카드가 설 자리를 잃는다. SDU 에서
   * 훑는 것은 담당자가 올린 S3 이지 사내망이 아니다.
   */
  const isIdc =
    !isSdu && detail != null && normalizeCloudProvider(detail.cloud_provider) === 'IDC';
  /**
   * 대상 종류가 거두어 가는 탭들. IDC 는 「스캔」, SDU 는 「연동 요청 정보」 — SDU 에는
   * 승인이 없어(계약 §0) 그 탭이 그릴 요청 자체가 만들어지지 않는다. 나머지 여덟은 SDU
   * 에서도 참이다: 스캔·Terraform·연결 테스트·Airflow 는 전부 대상 소스에 붙은
   * 오퍼레이션이지 프로바이더에 붙은 것이 아니다(§9).
   */
  const hiddenTabs: readonly TabLabel[] = [
    ...(isIdc ? [OPS_TAB_SLUGS.scan] : []),
    ...(isSdu ? [OPS_TAB_SLUGS.request] : []),
  ];
  // 걸러 내는 일은 **그룹 안에서** 일어난다 — 탭 하나가 빠져도 그룹은 넷 그대로고, 그
  // 그룹만 한 칸 줄어든다. 평평한 목록에서 걸러 낸 뒤 다시 묶으면 그룹이 사라지는 경우를
  // 따로 다뤄야 하는데, 이 화면에는 그런 경우가 없다.
  const tabGroups =
    hiddenTabs.length > 0
      ? TAB_GROUPS.map((group) => group.filter((tab) => !hiddenTabs.includes(tab)))
      : TAB_GROUPS;
  // 평평한 목록은 **그린 것에서** 나온다 — 같은 술어를 두 번 적으면 두 목록이 우연히만
  // 일치하고, 어긋나는 순간 `currentTab` 이 렌더되지 않는 탭을 가리킬 수 있다.
  const tabs = tabGroups.flat();
  const currentTab = tabs.includes(requestedTab) ? requestedTab : tabs[0];

  // A link to a tab this target does not have (`?tab=scan` on IDC, `?tab=request` on
  // SDU) — a bookmark from before the tab was dropped, or another target's link with the
  // id swapped — renders 진행 상태. Rewrite the URL to match,
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
      fetchLatestTest(targetSourceId, 'latest'),
      getTestConnectionResults(targetSourceId, 'latest'),
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

  /**
   * 대상이 바뀌면 이전 대상의 응답은 더 이상 사실이 아니다 — 언마운트 없이 id 만 바뀌는
   * 경로에서(같은 화면 안의 대상 이동) 옛 마스트헤드·티켓·TC 판정·DAG 가 새 대상의
   * **정착된 사실**로 서 있다가 응답이 하나씩 도착하며 뒤집힌다.
   *
   * 초기화는 조회 이펙트가 아니라 **여기**서 한다: 조회 이펙트는 `reloadKey` 로도 다시
   * 도는데(초기화·BDC 확인·승인 결정 뒤의 `retry`), 그 자리에서 비우면 화면이 매번
   * 셸 스켈레톤까지 되감긴다. 비워야 하는 것은 대상이 바뀌었을 때뿐이다.
   *
   * `savedRoleArns` 도 함께 비운다 — 그 한 칸은 `detail.metadata` 를 **덮는** 값이라,
   * 남겨 두면 새 대상의 role 자리에 앞 대상에서 방금 저장한 ARN 이 그대로 선다.
   * 설치모드·실데이터는 상세가 도착하며 그 자리에서 덮어써지고, 그전에는 상세가 null 이라
   * 마스트헤드 자체가 없다.
   *
   * 렌더 중에 비운다(이펙트가 아니라). 이펙트는 커밋 **뒤에** 도는 것이라 앞 대상의
   * 마스트헤드가 한 프레임 그려지고 나서 사라지고, `react-hooks/set-state-in-effect` 가
   * 그 자리를 막는다. 렌더 중의 갱신은 리액트가 자식을 커밋하기 전에 되감으므로 앞 대상은
   * 한 번도 새 id 로 그려지지 않는다 (react.dev, "prop 이 바뀔 때 state 초기화").
   */
  const [shownTarget, setShownTarget] = useState(targetSourceId);
  if (shownTarget !== targetSourceId) {
    setShownTarget(targetSourceId);
    setDetail(null);
    setDetailFailed(false);
    setProcessStatus(null);
    setProcessLoaded(false);
    setJiraTicket(null);
    setTicketLoaded(false);
    setSavedRoleArns({});
    setTcStatus(null);
    setTcLatest(null);
    setTcResults([]);
    setTcLoaded(false);
    setTcLatestFailed(false);
    setTcStatusFailed(false);
    setDag({ phase: 'loading' });
  }

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

      // Secondary loads are independent and best-effort — each block renders its
      // own fallback, so one failure must not blank the page.
      //
      // TC 도 대상 종류를 가리지 않는다. SDU 가 연결 테스트를 건너뛰던 시절의 게이트가
      // 여기 있었는데, 그때 SDU 는 탭이 하나도 서지 않아 받아도 읽을 사람이 없었다.
      // SDU 도 ProcessStatus 5 에 도착하고(계약 §8) 「연결 테스트」·「관리자 승인」 두
      // 탭을 그대로 받으므로, 이제 읽을 사람이 있다.
      void getProcessStatus(targetSourceId)
        .then((status) => !cancelled && setProcessStatus(status.process_status as ProcessStatus))
        .catch(() => !cancelled && setProcessStatus(null))
        .finally(() => !cancelled && setProcessLoaded(true));
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
   * §10 dag-status — **이 응답을 읽는 탭이 열려 있을 때** 받는다:
   *   관리자 승인 탭    승인 조건 ③ 이 판정을 건다
   *   Airflow 확인 탭   본문 전체가 이 응답이다
   * 대상 종류를 가리지 않는다. 예전에는 완료 승인(①)을 독자의 조건으로 두어 "아무도 읽지
   * 않을 MB 응답을 받지 않는다"를 지켰는데, 그 전제는 이미 만료됐다 — 진행 상태 탭의
   * 연동 현황 카드가 단계와 무관하게 서버에서 §10 을 부른다(#832, 오너 "6단계 상관없이
   * 그냥 조회해"). 그래서 ③ 은 ① 을 기다리지 않고 제 헬스를 판정하고, 어느 탭을 먼저
   * 들렀는지가 카드를 바꾸는 일도 없다. 승인 ↔ Airflow 를 오가는 동안은 이 값이 계속
   * true 라 deps 가 그대로다 — 그 전환으로는 다시 부르지 않는다.
   */
  const needsDag =
    currentTab === OPS_TAB_SLUGS.approval || currentTab === OPS_TAB_SLUGS.airflow;
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

  // 걸린 단계의 탭 — 7단계는 STEP_TAB 에 없고, 매핑된 탭이 그려지지 않는 대상(IDC 의
  // 스캔, SDU 의 연동 요청 정보)에서도 어느 탭에도 「현재 단계」가 서지 않는다.
  const stepTab = processStatus ? STEP_TAB.get(processStatus) ?? null : null;

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
              {/* 20px — `fmLabel` 이 14px 로 내려가면서 그 줄 상자가 19.60px 이 됐고(실측),
                  행 높이의 주인이 라벨에서 `fmGlyph`(h-5 = 20px)로 넘어갔다. 그래서 정착한
                  행의 내용 높이는 정확히 20.00px 이고, 24 로 두면 스켈레톤 마스트헤드가
                  그만큼 길어 도착하는 순간 탭 줄이 위로 뛴다 — 이 자리가 잡아야 하는 바로
                  그것이다. 이 값은 실측이라 라벨 크기가 또 움직이면 다시 재야 한다. */}
              <div className={cn(opsStyles.skeletonWash, 'h-[20px] w-[108px]')} />
            </div>
            <div className={opsStyles.fmGrid}>
              {[0, 1].map((row) => (
                <div key={row} className={cn(opsStyles.fmCell, 'col-span-4')}>
                  <div className={cn(opsStyles.skeletonWash, 'h-4 w-[64px]')} />
                  <div className={cn(opsStyles.skeletonWash, 'h-[24px] w-[180px]')} />
                </div>
              ))}
            </div>
          </div>
          {/* `tabStrip` draws both lines, so the skeleton strip already looks like the
              settled one — nothing here depends on the tab data that hasn't arrived. */}
          <div className={opsStyles.tabStrip}>
            {/* 보이지 않는 탭 하나가 레일 높이를 정확히 잡는다. */}
            <span className={cn(opsStyles.tab, 'invisible select-none')} aria-hidden>
              탭
            </span>
          </div>
        </div>
        <div className={opsStyles.body}>
          <div className={opsStyles.content}>
            {/* 본문도 **그리려는 탭의 발자국**을 잡는다 — `currentTab` 은 이 조기 반환 위에서
                이미 정해져 있으므로, 어느 탭이 정착할지는 상세가 없어도 안다.

                진행 상태(기본이자 딥링크 없이 들어오는 전부)는 두 칸이다. 한 칸짜리 320px
                블록으로 두면 상세가 도착하는 순간 한 칸이 두 칸으로 갈리면서 432px 로 뛴다
                (실측 320 → 432.39). 높이는 다시 세지 않고 정착 프레임의 클래스가 낳게 한다:
                `card.base`(pt-5/pb-6) + `pagedCardBody`(min-h-266) + 페이저(mt-4 h-8).

                ⚠️ SDU 는 이 행이 **둘**이다(실측 847.19). 그런데 SDU 인지는 상세가 와야
                알고, 두 행을 미리 그리면 SDU 가 아닌 대다수 대상에서 아래 카드가 없는
                432px 를 더 덮는다. 그래서 한 행 쪽을 고른다 — 모자란 쪽은 도착하며 자라고,
                넘치는 쪽은 없는 것을 덮는다.

                제목·설명은 막대다. 왼쪽 카드의 제목은 대상 종류가 정하고(SDU 면 「연동 대상
                정의」), 오른쪽은 서버가 그린 카드(`statusSlot`)의 것이라 여기서 손으로 옮겨
                적으면 같은 문자열의 두 번째 출처가 생긴다. */}
            {currentTab === OPS_TAB_SLUGS.status ? (
              <div className={opsStyles.cardsRow}>
                {[0, 1].map((column) => (
                  <div key={column} className={cn(pipelineStyles.card.base, opsStyles.pagedCard)}>
                    {/* 28px·19.6px — 정착본 제목(20px)과 설명(14px)의 줄 상자(실측). */}
                    <div className={cn(opsStyles.skeletonBar, 'h-[28px] w-[132px]')} />
                    <div className={cn(opsStyles.skeletonBar, 'mt-3 h-5 w-[216px]')} />
                    {/* `flex` + `flex-1` — 막대가 min-h-266 을 실제로 채운다. 높이를 여기
                        다시 적으면 그 266 이 두 곳에 살게 된다. */}
                    <div className={cn(opsStyles.pagedCardBody, 'flex')}>
                      <div className={cn(opsStyles.skeleton, 'flex-1')} />
                    </div>
                    {/* 페이저 자리 — 컨트롤은 그리지 않고 높이만 둔다 (`OpsPagination` mt-4 h-8). */}
                    <div className="mt-4 h-8" aria-hidden />
                  </div>
                ))}
              </div>
            ) : (
              /* 딥링크로 열리는 나머지 여덟 탭은 전부 **한 칸**이다(실측: 인프라 작업 638.98,
                 연결 테스트 425.59). 모양은 그것이고, 높이는 탭마다 달라 여기서 말할 수 있는
                 사실이 아니다 — 한 칸이라는 것만 말하고 높이는 잡지 않는다. */
              <div className={cn(opsStyles.skeleton, 'h-[320px]')} />
            )}
          </div>
        </div>
      </div>
    );
  }

  const meta = detail.metadata ?? {};

  // SDU 가 밑에 깔린 CSP 를 이긴다 — `cloud_provider` 는 'AWS' 여도 그 계정은 우리가
  // 설치하는 계정이 아니라, 계정·role·설치모드는 이 대상에 대해 아무 말도 하지 못한다
  // (담당자쪽 헤더가 `project.isSduType` 으로 내리는 것과 같은 판단, 결정 #49).
  const isAws = !isSdu && detail.cloud_provider === 'AWS';
  const accountId = meta.aws_account_id ?? '';
  const isChina = meta.is_china_region === true;
  // 중국만 이름을 갖는다 — Global 은 표시하지 않는다 (오너 2026-08-28). null 이면 모달이
  // 칩도 그 앞의 구분점도 그리지 않는다.
  const regionLabel = isChina ? COPY[locale].common.china : null;
  const activeRole = modal?.type === 'edit' ? modal.kind : null;

  return (
    // 서버가 그린 연동 현황 카드 안의 「상세보기」가 이 뷰의 탭 전환을 꺼내 쓴다.
    <OpsTabNavContext.Provider value={selectTab}>
    <div className={opsStyles.page}>
      <div className={opsStyles.masthead}>
        <OpsHeader
          targetSourceId={targetSourceId}
          detail={detail}
          processStatus={processStatus}
          processLoaded={processLoaded}
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
            // `role="presentation"` — 그룹은 균등 폭을 위한 상자일 뿐이라, tablist 가
            // 소유하는 것은 계속 탭 버튼이어야 한다.
            <div key={group[0]} role="presentation" className={cn(opsStyles.tabGroup, growOf(group.length))}>
              {group.map((tab) => {
                const active = tab === currentTab;
                const isStep = tab === stepTab;
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
                    {/* 보이는 낱말이 곧 접근명이다 — `.sr-only`·`title` 을 따로 두지 않는다.
                        공백 노드는 flex 에서 그려지지 않고, 접근명만 "확정 정보 현재 단계" 로
                        띄어 읽힌다. */}
                    {isStep && (
                      <>
                        {' '}
                        <span className={opsStyles.tabStepLabel}>현재 단계</span>
                      </>
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
          {/* 두 칸. 왼쪽이 이 대상에 대한 **기록**(승인 요청), 오른쪽이 **현재**(연동 현황)다.
              「현재 Process」 카드는 사라졌다 — 7칸 레일이 말하던 단계는 마스트헤드의 단계
              태그가 이미 말하고 있었고, 그 카드가 173px 을 써서 더하는 사실은 없었다.
              「상태 변경 이력」도 사라졌다: 전이 로그의 마지막 행이 곧 현재 단계라 레일의
              산문 버전이었고, 뒷받침 엔드포인트가 계약에 없었다(assumed §1). */}
          {currentTab === '진행 상태' &&
            /* SDU 에는 승인이 없어(계약 §0) 「승인 요청 내역」이 어느 대상에서도 영원히 빈
               표다. 그 자리는 담당자가 무엇을 입력했는지가 갖는데, 그것은 한 카드에 담기지
               않는다 — 정의(§3) · 확인(§5) · 수신자(§6) 셋을 한 카드 안에서 제목 굵기로만
               가르면 절 제목과 kv 라벨이 형제로 읽힌다. 그래서 카드가 그룹을 진다(오너 결정).
               두 칸 행을 두 번 쓴다: 새 격자를 만들 이유가 없다.
                 [연동 대상 정의][연동 현황]
                 [담당자 확인  ][수신자    ]
               SDU 가 아닌 대상은 그대로 한 행이다. */
            (isSdu ? (
              <>
                <div className={opsStyles.cardsRow}>
                  <SduDefinitionCard targetSourceId={targetSourceId} />
                  {statusSlot}
                </div>
                <div className={cn(opsStyles.cardsRow, 'mt-4')}>
                  {/* BDC 완료 단언이 대상 소스를 5단계로 옮긴다(델타 §3) — 화면은 그것을
                      스스로 계산하지 않고 process-status 를 다시 읽어 안다. */}
                  <SduAckCard targetSourceId={targetSourceId} onBdcChanged={retry} />
                  {/* 스캔 탭이 쓰는 그 카드다 — 한 명부를 두 벌 그리지 않는다. */}
                  <SduRecipientsCard targetSourceId={targetSourceId} />
                </div>
              </>
            ) : (
              <div className={opsStyles.cardsRow}>
                <ApprovalHistoryCard targetSourceId={targetSourceId} isIdc={isIdc} />
                {statusSlot}
              </div>
            ))}
          {currentTab === '스캔' && (
            <ScanTab
              targetSourceId={targetSourceId}
              detail={detail}
              // 탭이 `detail` 에서 다시 세우지 않는다 — provider 는 SDU 대상에서도 'AWS'
              // 라고 대답한다. 판정은 이 화면이 이미 내렸다.
              isSdu={isSdu}
              credentialReloadKey={savedRoleArns.scan}
            />
          )}
          {currentTab === '연동 요청 정보' && <RequestTab targetSourceId={targetSourceId} detail={detail} />}
          {currentTab === '확정 정보' && (
            <ConfirmTab
              targetSourceId={targetSourceId}
              detail={detail}
              processStatus={processStatus}
              // 상태가 아직 오지 않은 프레임은 판정이 아니다 — 탭은 그동안 스켈레톤이다.
              processLoaded={processLoaded}
              // 워크벤치의 세 축 중 「연동 요청 확인」은 SDU 에 없다 — 승인이 없어(§0)
              // 요청이 만들어지지 않으므로. 판정은 여기서 내린 것을 그대로 받는다.
              isSdu={isSdu}
              // 삭제 모달의 경고 카드가 여는 지름길이다 — 게이트의 출구가 아니다.
              // 삭제는 막히지 않고, 철거만 저쪽 탭의 일이라 그리로 한 번에 보낸다.
              onOpenInfra={() => selectTab('인프라 작업')}
            />
          )}
          {currentTab === '인프라 작업' && (
            <PipelineTab
              targetSourceId={targetSourceId}
              detail={detail}
              processStatus={processStatus}
              // 작업 시작 게이트의 마지막 갈래가 이 값으로 갈린다 — SDU 에는 확정 정보를
              // 직접 넣는 경로가 없어 「확정 정보 탭에서 확정하면」이 참이 아니다.
              onSelectTab={selectTab}
            />
          )}
          {currentTab === '연결 테스트' && (
            <TcTab
              targetSourceId={targetSourceId}
              isIdc={isIdc}
              // 설치가 끝났는지를 어느 계약에서 읽을지가 이 둘로 갈린다 — 인프라 작업 탭이
              // 쓰는 그 판정 두 벌을 그대로 쓴다(같은 대상이 두 탭에서 다르게 읽히지 않도록).
              provider={pipelineProviderKey(detail)}
              manualInstall={isManualInstall(detail)}
              latest={tcLatest}
              results={tcResults}
              statusLoaded={tcLoaded}
              latestFailed={tcLatestFailed}
              // 5단계 종료 조건 한 행이 읽는다 — 승인 탭 조건 ①·② 와 같은 값.
              processStatus={processStatus}
              tcStatus={tcStatus}
              tcStatusFailed={tcStatusFailed}
              onStatusReload={reloadTc}
              onAcknowledged={retry}
              onSelectTab={selectTab}
            />
          )}
          {currentTab === '관리자 승인' && (
            <ApprovalTab
              targetSourceId={targetSourceId}
              detail={detail}
              // 조건 ① 이 무슨 사실을 읽는지가 이 값으로 갈린다 — SDU 담당자는 완료 승인
              // 요청을 누르는 화면 자체를 걷지 않는다(계약 §0).
              isSdu={isSdu}
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
          {currentTab === '연동 초기화' && (
            // 초기화가 무엇을 버리는가는 대상 종류가 정한다(계약 §8).
            <DangerTab targetSourceId={targetSourceId} isSdu={isSdu} onReset={retry} />
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
    </OpsTabNavContext.Provider>
  );
}
