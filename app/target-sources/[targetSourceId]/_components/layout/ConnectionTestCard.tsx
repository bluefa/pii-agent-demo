'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cardStyles, cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
import { ChevronRightIcon, InfoCircleIcon } from '@/app/components/ui/icons';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { isRdsCluster } from '@/lib/rds-instances';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  ConsoleTable,
  type ConsoleTableColumn,
  type ConsoleTableGroup,
} from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { useModal } from '@/app/hooks/useModal';
import { usePagination } from '@/app/hooks/usePagination';
import { useRailHover } from '@/app/hooks/useRailHover';
import { useToast } from '@/app/components/ui/toast';
import { TcSummaryCard, TcSummaryCardSkeleton } from '@/app/components/features/process-status/TcSummaryCard';
import { CredentialMissingNotice } from '@/app/components/features/process-status/CredentialMissingNotice';
import { TcStatusTag } from '@/app/components/features/process-status/TcStatusTag';
import { TcRejectionNotice } from '@/app/components/features/process-status/TcRejectionNotice';
import { TcRunHistoryModal } from '@/app/components/features/process-status/TcRunHistoryModal';
import { isInFlightUi } from '@/app/hooks/useTestConnectionPolling';
import type { UseTestConnectionPollingReturn } from '@/app/hooks/useTestConnectionPolling';
import { useTcCompletionStatus } from '@/app/hooks/useTcCompletionStatus';
import { useTcSettleHold } from '@/app/hooks/useTcSettleHold';
import { useConfirmSubmit } from '@/app/hooks/useConfirmSubmit';
import {
  computeTcBuckets,
  foldAgentStatuses,
  foldTcCardState,
  type TcRunPhase,
} from '@/lib/test-connection-summary';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import {
  getLatestTestConnectionResultSummaries,
  getSecrets,
  updateResourceCredential,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { CredentialPickModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CredentialPickModal';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
import { LogicalDbGroupHeader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbGroupHeader';
import {
  buildLogicalDbCountMap,
  unitCounts,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';
import { CloudReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';
// This table shows the SAME resources steps 1·2·3 just showed, so it reads in their grammar
// rather than the db-list one: identity first, one line per cell, and the row-hover lifts that
// make a wide row scannable. Admin's request tables already borrow these for the same reason.
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  NAME_LIFT,
  NO_EXCLUSION_TEXT,
  ROW_BASE,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  hasLogicalDatabases,
  isEc2Instance,
  needsCredential,
  ProcessStatus,
  type SecretKey,
} from '@/lib/types';
import {
  GROUPED_CHILD_KIND_LABEL,
  toTestUnits,
  type TestUnit,
} from '@/lib/resource-grouping';

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

/**
 * 표의 Credential 조회 필터. 경고 줄이 유일한 진입점이라 'assigned' 로는 갈 수 없다 —
 * 분류값('assigned')은 `credState` 가 계속 쓰지만, 필터가 가질 수 있는 값은 이 둘뿐이다.
 */
type CredFilter = 'all' | 'missing';

/** Credential 수정 모달이 여는 행 — 쓰는 대상(resourceId)과 읽는 값(현재 배정). */
interface CredModalTarget {
  resourceId: string;
  current: string;
}

// Local credential edits — the confirmed list from the BFF seeds these, and Run Test
// persists any change via updateResourceCredential before triggering the async test.
type CredMap = Record<string, string>;

// Both copied from the steps 1·2·3 table so the two read as one surface.
const MONO_CELL = 'whitespace-nowrap font-mono text-[12px]';
const PLACEHOLDER = '—';

/** 아직 아무것도 읽지 못한 상태 — 모든 칸이 `—` 다. 매 렌더 새 Map 을 만들지 않는다. */
const EMPTY_COUNTS: LogicalDbCountMap = new Map();

const seedCreds = (confirmed: readonly ConfirmedResource[]): CredMap =>
  Object.fromEntries(confirmed.map((r) => [r.resourceId, r.credentialId ?? '']));

// "불필요" 로 떨어지는 것은 `needsCredential` 이 세는 IAM 기반 엔진뿐이다(lib/types.ts).
// 엔진을 모를 때(null·빈 문자열)는 여기서 false 다 — 없는 값을 "필요" 로 읽으면 이 화면에만
// 미설정 경고가 서고 Run Test 가 영영 막힌다. 계약상 database_type 은 optional 이다.
const requiresCredential = (databaseType: string | null): boolean =>
  !!databaseType && needsCredential(databaseType);

/**
 * Steps 1·2·3 order, verbatim: identity (name) → attributes (type · region) → what this
 * step asks of the row. A user arrives here having read the same rows three times already;
 * leading with Database Type made them re-find the anchor they had been scanning by.
 *
 * Resource ID is back (owner, 2026-08-27). This step used to be the ONE resource surface
 * without it — steps 1·2·3, 4 and 6·7 all carry it at the ledger's 186 — and the old
 * ruling here ("the row is already named, typed and located") was a width argument, not an
 * identity one: an Azure ARM id and an AWS ARN are what the reader copies out of this screen
 * to go look the target up, and step 5 is where they are told a target failed. Step 4 made
 * the same reversal on 2026-08-24, for the same reason and at the same cost.
 *
 * Floors are the LIN-96 ledger with two owner-ordered corrections to cred:
 * name 162 · id 186 · dbType 142 · region 156 · cred 200 · conn 104 ·
 * logicalDb 96 · logicalExcl 96 · logicalManage 96 — Σ **1238**.
 *
 * 논리 DB 열이 하나(118)에서 셋(96·96·96)이 된 라운드(오너 2026-08-28): 이 표도 IDC step 5
 * (`IdcResourceTable`)·확정 표(`WaitingApprovalTable`)와 같은 두 단 머리를 쓴다 —
 * `연동 논리 DB` 그룹 아래 `대상`·`제외`·`관리`. 118 은 `논리 DB 확인` 이라는 긴 라벨을
 * 담으려던 폭일 뿐이고, 카테고리를 그룹이 이고 가므로 잎 라벨은 한 마디로 짧아진다.
 * 잎 폭이 96 인 근거는 정렬이다: `IDC_COLUMN_WIDTHS.logicalDb/logicalExcl/logicalManage` 와
 * `WaitingApprovalTable` 의 confirmed 표가 전부 96 이라, 같은 두 단 머리를 쓰는 표들이 같은
 * 눈금으로 읽힌다. 그룹은 폭을 갖지 않으므로(ConsoleTable) 이 셋이 바닥의 전부다:
 * 1068 − 118 + 288 = **1238**.
 *
 * 96 이 이 표에서도 성립하는지는 실측으로 확인했다. `관리` 칸이 그리는 값은 하나뿐이다 —
 * `관리하기`(`idcStyles.triggerBtn.rowAction`, Pretendard 14px/500, 가로 패딩 없음)는
 * **48.40px** 이고, 칸의 내용 상자는 96 − 36(px-[18px] 양쪽) = 60px 이라 **11.60px** 이
 * 남는다. 논리 DB 를 관리하지 않는 엔진의 행은 이 칸을 비우므로 더 긴 값이 들어올 자리는
 * 없다. 머리 `관리` 는 14px/600 에서 24.20px + 36 = 60.20 이라 드래그 바닥도 96 아래에 있다.
 * IDC 표(`IDC_COLUMN_WIDTHS.logicalManage = 96`)는 같은 토큰의 같은 버튼을 같은 내용 상자에
 * 세운다 — 두 표가 같은 조건에서 같은 폭에 서 있다는 것이 이 96 의 정렬 근거다.
 *
 * cred history. 180 was sized in the Key1/Key2 synthetic-name era. On 2026-08-23 the owner
 * raised it to 264 so that every seeded credential name rendered whole — the longest,
 * `kimcs-postgres-analytics-readonly`, measured 203.37px at 13px/600 Pretendard, and
 * 264 = 203 + 36 padding + 25 slack. That decision stands as the reason this column is wider
 * than its header, but its arithmetic no longer holds, and this is a correction to the old
 * record rather than a new fact: the 14px row round silently ate the slack. Re-measured
 * in-browser at the cell's real computed style (14px/600 Pretendard) on
 * /pass/target-sources/1024, the same name is **219.74px** — the 13px figure reproduced
 * exactly, so the old record was sound; the cell simply got bigger. 219.74 + 36 = 255.74,
 * which left 264 holding **8.26px** of slack. The column was already near-tight, not generous.
 *
 * cred 264 → 200 (owner 2026-08-27). There is a **70px cliff** between the longest seeded
 * name and the next one: 219.74 against `jhpark-mssql-payments` at 149.21, then 141.71 ·
 * 132.27 · 126.07. The column therefore either carries the outlier or it does not, and every
 * value between ~200 and ~256 buys nothing. 200 = 149.21 + 36 padding + **14.79 slack**:
 * every seeded name fits whole except `kimcs-postgres-analytics-readonly`, which ellipsizes.
 * That is what makes 200 acceptable — the ellipsis path is already built and still wired
 * below: the value span carries `truncate` and the button carries `title={full name}`, so an
 * over-long name degrades to an ellipsis plus a native tooltip, never a silent cut.
 *
 * Cost: Σ 946 → 1132 → 1068 → 1238 moves the width at which this table starts scrolling
 * horizontally. Measured on /pass/target-sources/2004 (2026-08-27): the pane is fluid at
 * `innerWidth − 720` with both rails open, so the no-scroll threshold goes 1666 → 1852 →
 * 1788 → **1958**, and collapsing the guide rail returns 264px, bringing it 1588 → 1524 →
 * **1694**. Below that the table scrolls — which it already did at 1440, floor 946 and all.
 * Accepted with the column, the same trade step 4 took when its cloud floor went 538 → 836,
 * and the same trade the IDC step-5 table took for the same three leaves. ⛔ Do not buy
 * width back by narrowing the ledger floors, cred included: 200 is not a padded number, it
 * sits 14.79px clear of the second-longest real credential name, so shaving it starts
 * ellipsizing names that render whole today. (264 was never sacred — 200 is the floor now.)
 * The floors are registered across surfaces, and a step-5-only width is what breaks reading
 * down the columns.
 *
 * name + id are the flex PAIR every other resource table declares: id renders as the sink
 * (last flex) because the ARN/ARM-id is the longest value on the row and the only one whose
 * cut costs the reader, and having two makes dragging either behave like a split pane
 * (ConsoleTable `slackSinkKey`).
 */
const TC_COLUMN_WIDTHS = {
  name: 162,
  id: 186,
  dbType: 142,
  region: 156,
  cred: 200,
  conn: 104,
  // IDC 표·확정 표의 잎 폭과 같은 96 — 셋 다 `연동 논리 DB` 그룹 머리 아래 선다.
  logicalDb: 96,
  logicalExcl: 96,
  logicalManage: 96,
} as const;
const TC_FLEX_KEYS = ['name', 'id'] as const;

/** "DB" 는 표 전체가 이미 DB 얘기라 붙일 필요가 없었다. 대신 이 열이 무엇을 고르는
 *  것인지는 이름만으로 안 읽히므로 (i) 로 한 번 설명한다. 밝은 variant: 흰 표 위의
 *  검은 상자는 다른 시스템의 UI 처럼 보인다. */
const CREDENTIAL_HEAD = (
  <span className="inline-flex items-center gap-1">
    Credential
    {/* 엔진을 열거하지 않는다 — 목록(lib/types.ts NO_CREDENTIAL_ENGINES)은 엔진이
        늘 때마다 바뀌고, 여기 적은 예시는 같이 안 바뀐다. 표가 이미 찍은 값을
        가리키는 편이 언제나 참이다. */}
    <Tooltip
      variant="value"
      size="lg"
      content={
        <span className={idcStyles.table.headerTipBody}>
          해당 DB에 접속할 때 사용할 계정 정보예요. Credentials 메뉴에서 등록한 것 중에서 고르고,
          불필요로 표시된 대상은 이 단계에서 지정하지 않아요.
        </span>
      }
    >
      <InfoCircleIcon className={cn('h-3.5 w-3.5', textColors.tertiary)} aria-label="Credential 설명" />
    </Tooltip>
  </span>
);

const TC_COLUMNS: ConsoleTableColumn[] = [
  { key: 'name', label: 'Resource Name', width: TC_COLUMN_WIDTHS.name, flex: true, headClassName: idcStyles.table.nameCell },
  // The sink — see TC_COLUMN_WIDTHS.
  { key: 'id', label: 'Resource ID', width: TC_COLUMN_WIDTHS.id, flex: true },
  { key: 'dbType', label: 'Database Type', width: TC_COLUMN_WIDTHS.dbType },
  { key: 'region', label: 'Region', width: TC_COLUMN_WIDTHS.region },
  { key: 'cred', label: 'Credential', width: TC_COLUMN_WIDTHS.cred, head: CREDENTIAL_HEAD },
  { key: 'conn', label: '연결 상태', width: TC_COLUMN_WIDTHS.conn },
  // 셋은 `연동 논리 DB` 그룹 머리 아래 선다(`TC_GROUPS`), IDC step 5 와 같은 문법으로.
  // 그래서 열 이름이 카테고리를 되풀이하지 않고 `대상`/`제외`/`관리` 한 마디로 짧아진다.
  { key: 'logicalDb', label: '대상', width: TC_COLUMN_WIDTHS.logicalDb },
  { key: 'logicalExcl', label: '제외', width: TC_COLUMN_WIDTHS.logicalExcl },
  { key: 'logicalManage', label: '관리', width: TC_COLUMN_WIDTHS.logicalManage },
];

/**
 * 두 tier 헤더 — 셋을 한 이름 아래로 묶는다. `IdcResourceTable` 의 `idcGroups` 와 같은
 * 구조이고, 머리 내용(`LogicalDbGroupHeader`)은 **같은 컴포넌트**다: 대상과 제외가 서로
 * 다른 기준으로 세어진다는 문장은 한 곳에만 있어야 한다.
 */
const TC_GROUPS: readonly ConsoleTableGroup[] = [
  {
    key: 'logicalro',
    label: '연동 논리 DB',
    head: <LogicalDbGroupHeader />,
    columns: ['logicalDb', 'logicalExcl', 'logicalManage'],
  },
];

interface ConnectionTestCardProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  /** Refetch the project — advances to step 6 when the process status flips. */
  refreshProject: () => void;
  /** Step 이 소유한 폴링 — 헤더 태그(ProjectPageMeta)와 같은 관찰을 나눠 받는다. */
  polling: UseTestConnectionPollingReturn;
}

/**
 * Cloud Step 5 — connection test (v16 `data-prov-view="azure gcp aws"` card). Collapses
 * the former confirmed-resources + connection-test panel + logical-DB-check slots into one
 * card that mirrors the IDC step5 layout: conn-progress strip + a single table (cred select +
 * connection status + logical-DB-check) + a gated completion-approval request → CloudReqApprovalModal.
 *
 * Live wiring (ADR-019): Run Test persists changed credentials then triggers the async
 * connection test (`useTestConnectionPolling`); per-unit status is the FAIL-first fold of
 * the latest poll's agent results (lib/test-connection-summary). Once the run settles
 * SUCCESS the completion-status is fetched (useTcCompletionStatus) and the 완료 승인 요청
 * CTA opens only when it reads LATEST_TEST_CONNECTION_SUCCESS; the summary card holds the
 * state-driven CTA slot (시안 A — 실행 / 다시 실행 / 승인 요청 swap with the folded
 * card state), the run's timestamps and the 실행 이력 modal, and the rejection
 * notice surfaces the admin's re-run reason.
 */
export const ConnectionTestCard = ({
  targetSourceId,
  confirmed,
  refreshProject,
  polling,
}: ConnectionTestCardProps) => {
  const { latestJob, uiState, loading, canRunTest, retry, trigger, triggerError, fetchError } = polling;
  const [creds, setCreds] = useState<CredMap>(() => seedCreds(confirmed));
  const [approvalOpen, setApprovalOpen] = useState(false);
  // The table, the progress strip and the Run Test gate all run on units — one row per thing
  // the test reports on. Only the completion-approval summary still lists databases.
  const units = useMemo(() => toTestUnits(confirmed), [confirmed]);
  // Which folded regions are open. Collapsed by default: the databases are reference here —
  // nothing on those rows is acted on, and the row the user works with is the region.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Tree rails: hovering a folded region or any of its databases lights the whole rail.
  const railRow = useRailHover();
  const toggleUnit = useCallback((unitId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(unitId)) next.add(unitId);
      return next;
    });
  }, []);
  const [credFilter, setCredFilter] = useState<CredFilter>('all');
  const logicalModal = useModal<LogicalModalTarget>();
  const credModal = useModal<CredModalTarget>();
  const [savingCred, setSavingCred] = useState(false);
  const toast = useToast();

  // DB Credential options from GET .../secrets (not a hardcoded list). 이름만 뽑지 않고
  // 레코드를 그대로 들고 있는다 — 이름이 비슷한 후보를 가르는 것은 생성 시각이라, 고르는
  // 모달이 그 값을 같이 보여준다.
  const [credOptions, setCredOptions] = useState<SecretKey[]>([]);
  useEffect(() => {
    let active = true;
    void getSecrets(targetSourceId)
      .then((secrets) => {
        if (active) setCredOptions(secrets);
      })
      .catch(() => {
        if (active) setCredOptions([]);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

  // Re-seed credentials when the confirmed list changes (provider retry / target switch).
  // Adjusting state during render (the React "previous props" pattern) instead of an
  // effect — avoids the cascading-render an effect-body setState would cause.
  const [seededFrom, setSeededFrom] = useState(confirmed);
  if (seededFrom !== confirmed) {
    setSeededFrom(confirmed);
    setCreds(seedCreds(confirmed));
  }

  const testing = isInFlightUi(uiState);

  // 표의 `연동 논리 DB` 그룹이 읽는 수 — 최신 실행이 리소스별로 보고한 대상/제외 건수.
  // 한 번의 호출로 표 전체를 채우고, 개별 목록은 관리 모달이 열릴 때만 받아 온다.
  //
  // 언제 다시 읽는가: 실행 회차가 바뀌거나, 진행 중이던 실행이 정착할 때. 폴링은 실행
  // 동안 계속 돌지만 그때마다 때리지 않는다 — 도는 중에는 아직 이 회차의 건수가 없고,
  // 화면에 남는 것은 직전 회차의 수다(이 열이 말하는 것은 "최근 실행"이다).
  const runVersion = latestJob?.test_connection_version ?? null;
  const [fetchedCounts, setFetchedCounts] = useState<{
    targetSourceId: number;
    counts: LogicalDbCountMap;
  }>({ targetSourceId, counts: EMPTY_COUNTS });
  useEffect(() => {
    if (testing) return;
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, 'latest', {
      signal: controller.signal,
    })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setFetchedCounts({ targetSourceId, counts: buildLogicalDbCountMap(summaries) });
      })
      .catch(() => {
        // abort 는 실패가 아니다 — 대상을 갈아타거나 회차가 바뀌어 우리가 끊은 것이고,
        // 뒤이은 조회가 곧 답한다. 여기서 비우면 그 사이에 수가 한 번 깜빡인다.
        if (controller.signal.aborted) return;
        // 조회 실패는 빈 결과가 아니다 — 맵을 비워 모든 수를 `—` 로 되돌린다. 직전 회차의
        // 수를 그대로 두면 이번 회차가 보고한 값인 양 읽히고, 0 을 지어내면 "논리 DB 가
        // 없다" 라는, 계약이 답한 적 없는 사실이 화면에 선다.
        setFetchedCounts({ targetSourceId, counts: EMPTY_COUNTS });
      });
    return () => controller.abort();
  }, [targetSourceId, runVersion, testing]);
  // 어느 대상의 것으로 읽었는지 도장을 찍어 둔다 — resourceId 는 대상 간에 겹칠 수 있어서,
  // 대상을 갈아탄 직후의 낡은 맵은 남의 수를 이 행에 조용히 붙인다.
  const logicalDbCounts =
    fetchedCounts.targetSourceId === targetSourceId ? fetchedCounts.counts : EMPTY_COUNTS;

  // Per-unit verdict from the latest poll (hydrates on mount, B3). FAIL-first fold —
  // several agents may report on one unit, and the previous last-write-wins map could
  // overwrite a FAIL with a later SUCCESS (P4).
  const unitIds = useMemo(() => units.map((u) => u.unitId), [units]);
  const statusByResource = useMemo(
    () =>
      foldAgentStatuses(
        latestJob?.test_connection_agent_results ?? [],
        new Set(unitIds),
      ),
    [latestJob, unitIds],
  );

  // A row is connected when the latest poll returned SUCCESS for this unit. The credential
  // is NOT part of this: the test result is what the agent actually reported, and folding a
  // local "is a credential picked" check into it made a healthy target read 대기 — the strip
  // said "성공 2 · 대기 3 · 40%" for a run every unit had passed. A missing credential is
  // shown where it is fixed (the DB Credential column) and gates Run Test, nothing else.
  const unitCred = useCallback((unit: TestUnit) => creds[unit.members[0].resourceId] ?? '', [creds]);
  const rowConnected = useCallback(
    (unit: TestUnit): boolean => statusByResource.get(unit.unitId) === 'SUCCESS',
    [statusByResource],
  );

  // Credential 상태 분류 — 경고 줄과 표 필터가 같은 판정을 쓴다. `none` 은 Athena / DynamoDB /
  // CosmosDB 처럼 Credential 없이 연결하는 행("불필요")이고, 지정에도 미등록에도 잡히지 않는다.
  const credState = useCallback(
    (unit: TestUnit): 'all' | 'assigned' | 'missing' | 'none' =>
      !requiresCredential(unit.databaseType) ? 'none' : unitCred(unit) ? 'assigned' : 'missing',
    [unitCred],
  );
  const missingCount = useMemo(
    () => units.filter((u) => credState(u) === 'missing').length,
    [units, credState],
  );
  const filteredUnits = useMemo(
    () => (credFilter === 'all' ? units : units.filter((u) => credState(u) === credFilter)),
    [units, credFilter, credState],
  );

  // Drag-resizable columns — the instance lives with this screen's one table mount
  // (the shared shell's contract). The flex width is session-only like every console surface.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:tc-resources',
    ephemeralKeys: TC_FLEX_KEYS,
  });
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(filteredUnits, {
    initialPageSize: 10,
  });
  const handleCredFilter = useCallback(
    (next: CredFilter) => {
      setCredFilter(next);
      setPage(0);
    },
    [setPage],
  );
  // 미등록만 보는 중에 마지막 하나를 지정하면 경고 줄이 사라진다 — 필터를 그대로 두면 표가
  // 빈 화면이 되고, 그것을 되돌릴 컨트롤도 같이 사라진 뒤다. 사라질 때 같이 푼다.
  if (credFilter === 'missing' && missingCount === 0) {
    setCredFilter('all');
    setPage(0);
  }

  // Gate the 완료 승인 요청 CTA on completion-status (the contract's verdict), not on
  // the poll alone: LOGICAL_DATABASE_RECENTLY_UPDATED keeps it closed until a re-run,
  // exactly as the IDC step already does. The verdict also refines the settled card
  // state (성공/정책 변경/확인 완료 — foldTcCardState below).
  const {
    completion,
    approvalEnabled,
    policyChangedAt,
    failed: completionFailed,
    refresh: refreshCompletion,
  } = useTcCompletionStatus(targetSourceId, uiState, latestJob?.test_connection_version ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Run Test gate (v16 updateConnRunBtn): every row that needs a credential has one.
  const total = units.length;
  const allCredsSet =
    total > 0 && units.every((u) => !requiresCredential(u.databaseType) || !!unitCred(u));

  // 누를 수 있는지는 훅이 한 사실로 답한다(canRunTest). 여기서 조건을 다시 조립하지 않는다 —
  // 항을 하나 빠뜨리면 그 자리가 곧 "아직 모르는데 누를 수 있는" 창이 된다.
  const runDisabled = !canRunTest || !allCredsSet;
  // 잠긴 CTA 가 스스로 사유를 진다 — 미설정이 있을 때만이다. 실행이 도는 중이라 잠긴 버튼은
  // 기다리면 풀리므로 할 말이 없고, 그 국면의 슬롯은 아예 다른 버튼이다.
  const runBlockedTip =
    missingCount > 0
      ? `Credential 미설정 ${missingCount}건 — 지정해야 연결 테스트를 실행할 수 있습니다`
      : undefined;
  const runTest = useCallback(async () => {
    if (runDisabled) return;
    await trigger();
  }, [runDisabled, trigger]);

  // 모달의 저장이 PUT 을 쏘고, 성공했을 때만 로컬 값이 바뀐다.
  const handleCredSubmit = useCallback(async (next: string) => {
    const target = credModal.data;
    if (!target) return;
    setSavingCred(true);
    try {
      await updateResourceCredential(targetSourceId, target.resourceId, next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
      return;
    } finally {
      setSavingCred(false);
    }
    setCreds((prev) => ({ ...prev, [target.resourceId]: next }));
    credModal.close();
  }, [targetSourceId, toast, credModal]);

  // On save the skip policy persists, which flips completion-status
  // (LATEST_TEST_CONNECTION_SUCCESS → LOGICAL_DATABASE_RECENTLY_UPDATED, spec §7);
  // re-reading it closes the CTA and flips the card into the policy-changed state.
  //
  // The modal reports its own outcome now, so this runs when its result frame is
  // DISMISSED, not when the PUT lands: refreshProject() re-renders this card and would
  // unmount the frame before it could be read. Closing is the modal's own job too — the
  // frame's 닫기 is the way out.
  const handleSaved = useCallback(() => {
    refreshCompletion();
    refreshProject();
  }, [refreshCompletion, refreshProject]);

  // 요청 → 확인 프레임 → 전환. 1단계 승인 요청과 같은 훅이다: PUT 이 성공해도 화면을
  // 곧바로 갱신하지 않는다 — refreshProject() 가 상태를 CONNECTION_VERIFIED 로 바꾸는
  // 순간 이 카드가 통째로 교체되고, 안에 있던 모달은 확인 프레임을 보여주기도 전에
  // 언마운트된다. 갱신은 홀드가 끝난 뒤 settle 에서 부른다.
  //
  // PUT 이 여기로 올라온 것도 그래서다. 전에는 모달이 스스로 보내고 실패하면 toast 를
  // 띄웠는데, 그 toast 의 문구는 서버가 쓴 message 였다(ADR-008/ADR-013 위반).
  const approval = useConfirmSubmit({
    targetSourceId,
    pendingStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    request: async () => {
      await updateTestConnectionConfirmation(targetSourceId, true);
    },
    settle: () => {
      refreshProject();
      setApprovalOpen(false);
    },
  });
  const openApproval = useCallback(() => {
    // 지난 실패 프레임이 다시 뜨지 않도록 열기 전에 되돌린다.
    approval.reset();
    setApprovalOpen(true);
  }, [approval]);

  // Phase-aware buckets (shared rule): 미보고 is its own fact, never folded into 대기,
  // and % counts reported units only — an unfinished run can no longer read "100%".
  const buckets = useMemo(() => computeTcBuckets(unitIds, statusByResource), [unitIds, statusByResource]);
  // Phase from the RUN's own status, not re-derived from counts — the summary must say
  // what latest_version says, and the counts sit beside it as the evidence.
  // `holding` 은 표시 국면만 붙잡는다: 정착 직후 400ms 동안 최종 버킷을 든 running
  // 프레임이 서서 바가 끝까지 차는 걸 보여준 뒤 판정 프레임으로 넘어간다. Run Test
  // 버튼·승인 게이트는 실 상태(testing/uiState)를 그대로 쓴다.
  const { holding, settledLive } = useTcSettleHold(latestJob);
  // holding 이 QUEUED 보다 앞: 정착 박자 동안은 최종 버킷을 든 running 프레임이 선다.
  const phase: TcRunPhase = holding
    ? 'running'
    : uiState === 'QUEUED'
      ? 'queued'
      : uiState === 'RUNNING'
        ? 'running'
        : uiState === 'SUCCESS'
          ? 'success'
          : uiState === 'FAIL'
            ? 'fail'
            : 'idle';
  // 시안 A: run phase × completion verdict → one card state, one slot CTA. The header
  // Run Test and the bottom action bar both folded into the strip's slot — at any
  // moment the card shows one primary.
  const cardState = foldTcCardState(phase, completion);
  // Completion-approval gate: every target connected, no test in flight, and
  // completion-status reads LATEST_TEST_CONNECTION_SUCCESS.
  const canRequestApproval = total > 0 && buckets.ok === total && !testing && approvalEnabled;

  return (
    <section className={cardStyles.base}>
      <header className={cardStyles.header}>
        <div>
          <div className="flex items-center gap-2">
            <span className={cardStyles.stepTag}>5단계</span>
            <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
          </div>
          <p className={cn('mt-2.5 break-keep', cardStyles.subtitle)}>
            연동 대상 DB에 접근하기 위한 PII Agent 리소스가 생성됐어요.{' '}
            <span className={primaryColors.text}>
              Credential을 등록한 다음 리소스별 Key를 지정하면 연결 테스트
            </span>를 진행할 수 있어요. 테스트가 모두 성공하면 완료 승인 요청을 진행할 수 있어요.
          </p>
          {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (다른 스텝 카드와 같은 문법). */}
          <p className={cn('break-keep', cardStyles.subtitle)}>
            DB 내에 연동이 불필요한 논리 DB가 있다면 해당 논리 DB는 연동에서 제외할 수 있어요. 이 절차는
            연결 테스트 완료 후에 진행할 수 있어요.
          </p>
        </div>
      </header>
      {/* Two groups, not one even stack: distance carries ownership (proposal A). Inside a
          group rows sit 8px apart; the verdict group and the table group are 24px apart. */}
      <div className={cn(cardStyles.body, 'space-y-6')}>
        <div className="space-y-2">
          <TcRejectionNotice
            targetSourceId={targetSourceId}
            runVersion={latestJob?.test_connection_version ?? null}
          />
          {loading ? (
            <TcSummaryCardSkeleton />
          ) : (
          <TcSummaryCard
            state={cardState}
            buckets={buckets}
            run={
              latestJob
                ? {
                    requestedAt: latestJob.requested_at ?? null,
                    completedAt: latestJob.completed_at ?? null,
                  }
                : null
            }
            policyChangedAt={policyChangedAt}
            drawCheck={settledLive}
            onRunTest={() => void runTest()}
            runDisabled={runDisabled}
            runBlockedTip={runBlockedTip}
            onRequestApproval={openApproval}
            approvalDisabled={!canRequestApproval}
            historyAction={
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className={cn(idcStyles.triggerBtn.linkNeutral, 'whitespace-nowrap text-[12px]')}
              >
                실행 이력
              </button>
            }
          />
          )}
          {/* 실패한 완료 상태 조회는 닫힌 게이트와 같은 픽셀이면 안 된다 — 이유 없이 비활성인
              승인 버튼만 남는다. fetchError 와 같은 문법: 한 줄 + 재시도. */}
          {completionFailed && (
            <p className={cn('flex items-center gap-2 text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
              {ERROR_MESSAGES.TEST_CONNECTION_COMPLETION_FETCH_FAILED}
              <button
                type="button"
                onClick={refreshCompletion}
                className={cn(idcStyles.triggerBtn.linkNeutral, 'text-[12px]')}
              >
                다시 시도
              </button>
            </p>
          )}
          {triggerError && (
            <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>{triggerError}</p>
          )}
          {/* 조회가 실패하면 실행 CTA 는 잠긴 채로 남는다(무엇이 도는지 모르므로). 그 잠금을 푸는
              길은 조회 성공뿐이라, 폴링이 포기한 뒤에는 이 버튼이 유일한 출구다. */}
          {fetchError && (
            <p className={cn('flex items-center gap-2 text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
              {ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED}
              <button
                type="button"
                onClick={() => void retry()}
                className={cn(idcStyles.triggerBtn.linkNeutral, 'text-[12px]')}
              >
                다시 시도
              </button>
            </p>
          )}
          </div>
        <div className="space-y-2">
          {/* Table + pagination are ONE stack, exactly as steps 2·3 and 6·7 compose them: the
              table itself carries no border or shadow, and the pagination bar below supplies the
              only stroke and the bottom radius. The framed `table.frame` this used to sit in drew
              a second box inside the card — a card inside a card, at a heavier weight than any
              border on those steps.
              Those steps cap the stack with the filter toolbar (top-rounded, the approvalHeader
              fill); here the header row — same fill — is the cap and takes the radius. */}
          {/* 미등록이 0 인 것이 정상 상태다. 그 사실을 말하려고 상시 카드 세 장을 두었더니, 아무 할
              일이 없다는 말이 화면의 90px 을 차지했고 (전체 = 지정 + 미등록) 도 성립하지 않았다 —
              Athena·DynamoDB 처럼 Credential 이 "불필요" 한 행은 어느 카드에도 안 잡히기 때문이다.
              조치가 필요할 때만 알림이 생긴다. 그 안의 링크가 곧 필터이므로 요약과 도달 수단이 한
              물건이고, 분류를 세지 않으니 합계가 어긋날 수도 없다. */}
          {/* 상자다 (오너 2026-08-30, 시안 A). 맨 줄이던 것을 세 화면이 같은 컴포넌트로 함께
              바꾼다 — 어휘도 모양도 CSP 마다 갈리지 않는다. */}
          <CredentialMissingNotice
            count={missingCount}
            filterOn={credFilter === 'missing'}
            onToggleFilter={() => handleCredFilter(credFilter === 'missing' ? 'all' : 'missing')}
          />
          <div>
            {/* The console shell owns the scroll box (its wrapper is the overflow-x-auto
                escape), the header row, and the resize grammar; the frame above it keeps the
                radius clip. 연결 상태 칸이 스켈레톤인 동안은 표가 아직 채워지는 중이다 —
                보조기술에도 그렇게 말한다(`busy` → 표의 aria-busy). */}
            <div className={cn(CONNECTED_FRAME, 'rounded-t-[12px]')}>
              <ConsoleTable columns={TC_COLUMNS} groups={TC_GROUPS} resize={resize} busy={loading}>
                <tbody className={idcStyles.table.body}>
                  {pageRows.map((unit) => {
                    const cred = unitCred(unit);
                    const status = statusByResource.get(unit.unitId);
                    const connected = rowConnected(unit);
                    const credRequired = requiresCredential(unit.databaseType);
                    const [first] = unit.members;
                    const open = expanded.has(unit.unitId);
                    // 행마다 반복되는 접근성 이름의 주어 — 관리하기 버튼이 이미 쓰던 것과
                    // 같은 값이라, 한 행의 세 컨트롤이 같은 이름으로 자기 행을 가리킨다.
                    const rowName = first.resourceName ?? first.resourceId;
                    const logicalManaged = hasLogicalDatabases(unit.databaseType);
                    // 접힌 Athena 행은 **단위 id** 로 찾는다 — 결과가 리전 한 줄로 오므로
                    // 멤버 id 로는 아무것도 안 잡힌다(logical-db-summaries 의 unitCounts).
                    // 엔진으로 거르지 않는다: 실행이 이 단위를 두고 보고한 수는 그 엔진이
                    // 논리 DB 를 관리하든 아니든 사실이고, 보고가 없으면 여기서 이미 null 이다.
                    const logicalCount = unitCounts(unit, logicalDbCounts);
                    // Only a folded region draws a rail; a flat unit gets no handlers so a
                    // pointer move down the list does not re-render the table for nothing.
                    const rail = unit.folded ? railRow(unit.unitId) : undefined;
                    // Only a tagged row is two lines — an untagged one is already on the middle.
                    const stackedIdentity =
                      isRdsCluster(unit.resourceType ?? '') || isEc2Instance(unit.resourceType);
                    return (
                      <Fragment key={unit.unitId}>
                      <tr
                        className={cn(ROW_BASE, ROW_TARGET, unit.folded && 'cursor-pointer', rail?.className)}
                        onClick={unit.folded ? () => toggleUnit(unit.unitId) : undefined}
                        onMouseEnter={rail?.onMouseEnter}
                        onMouseLeave={rail?.onMouseLeave}
                      >
                        {/* A folded row stands for a REGION, which has no resource name, so this
                            cell carries the disclosure and the engine's label instead. Opening it
                            lists the databases below, in the column their names belong to.
                            The label reads in the SAME type as every other name in this column,
                            not in the steps 1·2·3 group-parent weight: there a heavier parent
                            separates itself from the children right under it, here the row's
                            neighbours are ordinary resources and a bolder one would just shout. */}
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            idcStyles.table.nameCell,
                            idcStyles.table.consoleCell,
                            'font-mono text-[14px]',
                            textColors.primary,
                            NAME_LIFT,
                            unit.folded && open && idcStyles.table.group.parentCell,
                          )}
                        >
                          {unit.folded ? (
                            <span className={idcStyles.table.group.lead}>
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={`${unit.region ?? ''} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleUnit(unit.unitId);
                                }}
                                className={cn(
                                  idcStyles.table.group.toggle,
                                  open
                                    ? idcStyles.table.group.toggleOpen
                                    : idcStyles.table.group.toggleClosed,
                                  primaryColors.focusRing,
                                )}
                              >
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              </button>
                              <span className="whitespace-nowrap">
                                {getDatabaseShortLabel(unit.databaseType ?? '')}
                              </span>
                            </span>
                          ) : (
                            // One line, always — the widest names here ran to four lines and left
                            // row heights ragged. Full value in the tip, as on steps 1·2·3.
                            // A cluster stacks the RDS Cluster tag above the name, the same
                            // two-line identity steps 1·2·3·4·6·7 use.
                            <span className={cn(
                              'flex min-w-0 flex-col items-start gap-1',
                              stackedIdentity && idcStyles.table.stackedIdentityLift,
                            )}>
                              {isRdsCluster(unit.resourceType ?? '') && <RdsClusterTag />}
                              {isEc2Instance(unit.resourceType) && <Ec2InstanceTag />}
                              <Tooltip
                                content={
                                  <IdentifierTip label="Resource Name" value={first.resourceName ?? ''} />
                                }
                                variant="value"
                                size="md"
                                // w-full min-w-0, not a px cap: the COLUMN owns the cut now,
                                // and under the stack's items-start a bare block would size to
                                // its own content and never truncate (the manual-EC2 lesson).
                                triggerClassName="w-full min-w-0 block"
                                truncatedOnly
                              >
                                <span className="block truncate">
                                  {first.resourceName || PLACEHOLDER}
                                </span>
                              </Tooltip>
                            </span>
                          )}
                        </td>
                        {/* The unit's own id: for a folded row that is the REGION id the
                            result is keyed on (`resultUnitId`), which is exactly the value a
                            reader chasing this row's verdict needs — not the id of whichever
                            database happens to be first. For every other row unitId IS
                            resourceId. Same covered-clip + hover-copy cell steps 2·3·4·6·7
                            use, so one id reads the same way down the whole flow.
                            A folded row toggles on click and this cell holds a copy button —
                            without the guard, copying the region id also opened the fold. */}
                        <td
                          className={cn(idcStyles.table.approvalCell, idcStyles.table.consoleCell)}
                          onClick={unit.folded ? (event) => event.stopPropagation() : undefined}
                        >
                          <ResourceIdCell
                            value={unit.unitId}
                            label="Resource ID"
                            // +18px = this cell's own right padding, so the wrapper ends ON the
                            // column boundary and the overlay copy button anchors there.
                            maxWidthClass="w-[calc(100%+18px)]"
                            sizeClass="text-[14px]"
                            textClassName={cn(textColors.secondary, CELL_LIFT)}
                            hardClip
                          />
                        </td>
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            idcStyles.table.consoleCell,
                            'text-[12px]',
                            textColors.secondary,
                            CELL_LIFT,
                          )}
                        >
                          {unit.databaseType ? getDatabaseShortLabel(unit.databaseType) : PLACEHOLDER}
                        </td>
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            idcStyles.table.consoleCell,
                            MONO_CELL,
                            textColors.secondary,
                            CELL_LIFT,
                          )}
                        >
                          {unit.region || PLACEHOLDER}
                        </td>
                        {/* 값은 밑줄 텍스트로 읽고 수정은 모달에서 — 관리자 화면의 Credential
                            배정과 같은 문법이다. 행마다 select 를 놓으면 표가 컨트롤 판이 되고,
                            고르는 순간 저장돼 두 후보를 비교할 수도 없었다.
                            Athena·DynamoDB 처럼 Credential 없이 연결하는 엔진은 고칠 것이 없으므로
                            버튼이 아니라 평문이다. */}
                        <td className={idcStyles.table.approvalCell}>
                          {credRequired ? (
                            <button
                              type="button"
                              onClick={() =>
                                credModal.open({
                                  resourceId: first.resourceId,
                                  current: cred,
                                })
                              }
                              aria-label={`${first.resourceName ?? first.resourceId} Credential 수정 — 현재 ${cred || '미설정'}`}
                              title={cred || undefined}
                              // 컷은 열이 소유한다(max-w-full): 픽셀 캡이 남아 있으면 열을 드래그로
                              // 늘려도 이름이 더 안 보이는 리사이즈 벽이 된다. 200 열은 시드 실명
                              // 대부분을 통째로 보여주고, 가장 긴 하나만 말줄임된다 —
                              // `kimcs-postgres-analytics-readonly` 는 14px 에서 219.74px 라 149.21px 인
                              // 다음 이름과 70px 떨어져 있고, 그 하나를 위해 열이 매 행 64px 를 들고
                              // 있을 값이 아니었다. 잘린 값은 `title` 툴팁이 통째로 되돌려 준다.
                              className={cn(idcStyles.triggerBtn.linkNeutral, 'max-w-full')}
                            >
                              {cred ? (
                                <span className="min-w-0 truncate font-mono">{cred}</span>
                              ) : (
                                <span className="font-sans">미설정</span>
                              )}
                            </button>
                          ) : (
                            <span
                              className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                            >
                              불필요
                            </span>
                          )}
                        </td>
                        {/* 어휘·스켈레톤 규칙은 `TcStatusTag` 가 진다 — IDC step 5 의 표가 같은
                            칸을 그리므로, 두 CSP 가 같은 판정을 다른 말로 하지 않도록 한 곳에 둔다. */}
                        <td className={idcStyles.table.approvalCell}>
                          <TcStatusTag
                            status={status}
                            // 조회를 못 했으면 회차가 없다고 단정하지 않는다 — 실패는 빈 결과가 아니다.
                            // 스냅샷이 있으면 '읽지 못했다'가 아니다 — 그 회차가 이 행을 언급하지 않았을 뿐이라
                            // 미보고가 참이고, 카드 카운트 줄도 같은 순간 미보고로 센다.
                            // null 은 스냅샷 자체가 없을 때만(usePollingBase 는 에러 때 data 를 비우지 않는다).
                            hasRun={fetchError && !latestJob ? null : !!latestJob}
                            loading={loading}
                          />
                        </td>
                        {/* `연동 논리 DB` 그룹의 세 칸 — 수는 **값**이고 행위는 옆 칸의 이름
                            붙은 버튼이다(IDC step 5 와 같은 문법). 수에 `onOpen` 을 주지
                            않으므로 평문으로 서고, 문은 하나뿐이다.
                            Athena·DynamoDB are IAM-based and have no logical-DB management at all,
                            so there is nothing here to configure — the button used to open anyway
                            (it was gated on `connected` alone) onto a screen for a concept that
                            does not exist. Keyed on the engine, not on the Athena fold: DynamoDB
                            has no region fold to read off.
                            그 엔진 규칙은 **제외·관리** 두 칸만 소유한다. `대상` 은 실행이 이
                            단위를 두고 보고한 수 그대로다 — Athena 리전은 제 데이터베이스 수를
                            보고하고, 그것은 접었다 펴면 세어지는 자식 행 수와 같은 수다. */}
                        <td className={idcStyles.table.approvalCell}>
                          {/* `label` 은 required 지만 이 표에서는 DOM 에 나오지 않는다 —
                              `LogicalDbCountCell` 이 그것을 쓰는 곳은 `onOpen` 갈래의
                              aria-label 하나뿐이고, 여기 수는 평문이다. */}
                          <LogicalDbCountCell
                            count={logicalCount.target}
                            label={`${rowName} 연동 대상 논리 DB`}
                          />
                        </td>
                        {/* 제외는 정책이지 실행 결과가 아니다 — 논리 DB 가 없는 엔진에는
                            제외할 대상 자체가 없으므로 미실행·진행 중·성공·실패 어느 회차에서도
                            같은 답이다. 목이 주는 `excluded_logical_database_count: 0` 은 여기서
                            쓰지 않는다: 0 은 "제외한 게 없다"고 말할 뿐이다. */}
                        <td className={idcStyles.table.approvalCell}>
                          {!logicalManaged ? (
                            <span
                              className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                            >
                              {NO_EXCLUSION_TEXT}
                            </span>
                          ) : (
                            // 위 칸과 같다 — required 라 넘길 뿐, 평문 갈래는 `label` 을 쓰지 않는다.
                            <LogicalDbCountCell
                              count={logicalCount.excluded}
                              label={`${rowName} 연동 제외 논리 DB`}
                            />
                          )}
                        </td>
                        {/* 한 행에서 같은 사실을 두 번 말하지 않는다 — 옆 칸의 `제외 불가` 가
                            이미 이 엔진에 제외 정책이 없다고 답했고, `설정 불필요` 는 그 말의
                            사본이었다. 관리할 것이 없는 행의 관리 칸은 비어 있는 게 맞다. */}
                        <td className={idcStyles.table.approvalCell}>
                          {logicalManaged && (
                            <button
                              type="button"
                              disabled={!connected}
                              onClick={() =>
                                logicalModal.open({
                                  resourceId: first.resourceId,
                                  resourceName: rowName,
                                })
                              }
                              // The label is the same word on every row, so it carries the row's own
                              // name — ten identically named buttons are indistinguishable in a screen
                              // reader's element list. Same shape the IDC table's action uses.
                              aria-label={`${rowName} 연동 논리 DB 관리하기`}
                              className={idcStyles.triggerBtn.rowAction}
                            >
                              관리하기
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Database list. The name, and what the name IS — read down the tree the
                          Database Type column says Athena → Database, exactly as on steps 1·2·3.
                          Without it `default` is just a string. Every other cell stays empty: the
                          region row above already answers them and none of it varies per database. */}
                      {unit.folded &&
                        open &&
                        unit.members.map((db, index) => (
                          <tr
                            key={db.resourceId}
                            className={cn(ROW_BASE, rail?.className)}
                            onMouseEnter={rail?.onMouseEnter}
                            onMouseLeave={rail?.onMouseLeave}
                          >
                            <td
                              className={cn(
                                idcStyles.table.approvalCell,
                                idcStyles.table.consoleCell,
                                'font-mono text-[14px]',
                                textColors.primary,
                                idcStyles.table.group.childCell,
                                index === unit.members.length - 1 &&
                                  idcStyles.table.group.childCellLast,
                              )}
                            >
                              {db.resourceName ?? db.resourceId}
                            </td>
                            {/* Inside a group the id is dropped — it is the parent's own path
                                with the child's name tacked on, so the row would repeat the
                                region's identity and then say its name a second time. Same
                                rule as the confirmed table. */}
                            <td className={idcStyles.table.approvalCell} />
                            <td
                              className={cn(
                                idcStyles.table.approvalCell,
                                'text-[12px]',
                                textColors.secondary,
                              )}
                            >
                              {GROUPED_CHILD_KIND_LABEL}
                            </td>
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                            {/* 논리 DB 세 칸도 다른 칸과 같이 비운다 — 결과는 리전(= 단위)에
                                키가 잡히므로 위 행이 이미 답했고, 칸이 하나라도 빠지면 행이
                                머리와 어긋난다. */}
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className={cn(
                          idcStyles.table.approvalCell,
                          'py-8 text-center text-[12px]',
                          textColors.tertiary,
                        )}
                      >
                        조건에 맞는 결과가 없어요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </ConsoleTable>
            </div>
            {filteredUnits.length > 0 && (
              <Pagination
                size="md"
                page={page}
                pageSize={pageSize}
                totalCount={filteredUnits.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </div>
          </div>
        <CloudReqApprovalModal
          isOpen={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          resources={confirmed}
          targetSourceId={targetSourceId}
          phase={approval.phase}
          pending={approval.pending}
          errorCode={approval.errorCode}
          onSubmit={approval.submit}
          onRetry={approval.retry}
        />
        {credModal.data && (
          <CredentialPickModal
            isOpen={credModal.isOpen}
            onClose={credModal.close}
            target={{ label: 'Resource ID', value: credModal.data.resourceId }}
            value={credModal.data.current}
            options={credOptions}
            saving={savingCred}
            onSubmit={handleCredSubmit}
          />
        )}
        <TcRunHistoryModal
          open={historyOpen}
          targetSourceId={targetSourceId}
          onClose={() => setHistoryOpen(false)}
        />
        {logicalModal.data && (
          <LogicalDbModalLoader
            open={logicalModal.isOpen}
            targetSourceId={targetSourceId}
            scope="latest"
            resourceId={logicalModal.data.resourceId}
            resourceName={logicalModal.data.resourceName}
            completedAt={latestJob?.completed_at ?? null}
            onSaved={handleSaved}
            onClose={logicalModal.close}
          />
        )}
      </div>
    </section>
  );
};
