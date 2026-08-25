'use client';

/**
 * 확정 정보 card — the single per-resource table of this tab.
 *
 * Rows come from the confirmed snapshot (GET …/confirmed-integration, snake
 * passthrough per ADR-019). Two joins by `resource_id` fill the trailing columns,
 * each from the endpoint whose contract actually declares it —
 *   연결 상태 · 실패 사유 · Pod 로그  latest_version.test_connection_agent_results[]
 *                                   (tcFactsByResource — 판정 + fail_reason + pod_id)
 *   논리 DB 건수                     latest-results (logical_database_count / excluded_…)
 * A resource neither reports on renders — for those columns; nothing is inferred
 * from the snapshot alone (an installed resource is not a tested one). 무보고(—)는
 * 대기(PENDING, agent 가 보고한 사실)와 다른 사실이라 서로 다른 픽셀을 받는다.
 *
 * Per-row controls: Credential 배정 (searchable combobox over GET …/secrets — the
 * contract's credential list, whose card sits at the top of the tab) and
 * 논리 DB 관리 (skip policy).
 *
 * Rows/secrets are fetched by TcTab and passed in, because the credential card
 * needs the same two datasets to answer "이 자격 증명이 몇 건에 배정됐나".
 *
 * An absent snapshot (404 before 연동 확정) is an empty state, not an error; a real
 * fetch failure adds a 다시 시도 affordance to that same empty state so the two are
 * never confused with "확정된 리소스가 0건".
 */
import { Fragment, useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import {
  updateResourceCredential,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import { isEc2Instance, type SecretKey } from '@/lib/types';
import { GROUPED_CHILD_KIND_LABEL } from '@/lib/resource-grouping';
import { isRdsCluster } from '@/lib/rds-instances';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { InfoCircleIcon } from '@/app/components/ui/icons';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { IdcEndpointCell } from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import { toIdcResourceViewFromConfirmed } from '@/app/lib/api/idc';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  TC_TONE_FILL,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { LdbManageModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import { TcPodLogModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcPodLogModal';
import { failReasonView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/failReason';
import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';
import { CredentialAssignModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/CredentialAssignModal';
import {
  credentialEntries,
  filterConfirmedRows,
  ldbCount,
  podLogState,
  toConfirmedUnits,
  unitCredentialMissing,
  unitNeedsCredential,
  type TcResourceFact,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** One page's worth, same as the Step 6·7 confirmed table. */
const PAGE_SIZE = 10;

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

/** A blank cannot be an option — a condition nobody can pick stays out of the list. */
const uniqueSorted = (values: readonly string[]): string[] =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

/**
 * 표는 사용자 화면이 쓰는 콘솔 표(시안 F) 그 자체다 — `ConsoleTable` 셸을 그대로 쓴다
 * (오너 2026-08-25). 예전에는 그 표의 치수(18/16 · 옅은 머리띠 · 헤어라인)만 베껴 --pl-*
 * 로 다시 그렸는데, 베낀 것은 치수뿐이라 열 드래그·시임 트레이서·덮어 자르는 셀 문법이
 * 전부 빠져 있었다. 셸을 공유하면 두 화면의 표가 같은 제스처에 같은 답을 한다.
 *
 * 셸이 가져오는 것: table-fixed 격자, 머리 레일과 리사이즈 손잡이, 경계 시임 트레이서,
 * 싱크 열(폭을 흡수하는 flex 열). 셸이 **안** 가져오는 것: 프레임·툴바·페이저 — 그건 이
 * 카드의 몫이라 아래에 그대로 남는다.
 */
const TABLE_FRAME = 'rounded-b-[10px] border border-t-0 border-[var(--pl-border)]';
/** The toolbar is attached to the table — a gap between them leaves the search box unable to say which table it filters. */
const TOOLBAR =
  'mt-3 flex flex-wrap items-center gap-2 rounded-t-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-4 py-3';
const SEARCH_INPUT =
  'h-8 w-[260px] flex-none rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[14px] text-[var(--pl-text-strong)] focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] focus:outline-none';
/** 셸이 머리를 그리므로 남는 것은 본문 칸뿐 — 치수는 사용자 화면 표의 `approvalCell`. */
const CELL = cn(idcStyles.table.approvalCell, 'align-middle text-[14px] text-[var(--pl-text-strong)]');
/** 값을 덮어 자르는 칸(시안 F) — 넘치는 값이 말줄임 대신 다음 열 밑으로 이어진다. */
const CLIP_CELL = cn(CELL, idcStyles.table.consoleCell);

/**
 * 열 폭.
 *
 * flex 는 **정체 열 하나뿐**이다. 셸의 싱크(남는 폭을 흡수하는 열)는 마지막 flex 열이
 * 지므로, Credential 을 같이 flex 로 두면 싱크가 그쪽으로 가서 `hgildong-mysql-prod`
 * 한 줄이 380px 를 차지하고 정작 ARN 은 그대로 잘린다 — 사용자 화면 Step 5 가 같은 이유로
 * 단일 flex 를 쓴다("a forced second flex would hand the sink to a short-valued column").
 * 행마다 임의로 길어지는 값은 정체(이름 + ARN)뿐이다.
 *
 * cred 264 는 오너가 못 박은 값이다 — 실제 store 이름 `kimcs-postgres-analytics-readonly`
 * 가 잘리지 않는 폭(PR #767).
 *
 * type 은 라벨이 `Database Type · Region` 이라 190 이다. 셸은 넘치는 값을 말줄임 없이
 * 덮어 자르는데, 그 문법이 **머리글**에 걸리면 열 이름이 깨진 것처럼 읽힌다. IDC 는 리전이
 * 없어 라벨이 짧으므로 같이 줄인다.
 */
const COL_W = { name: 240, type: 190, typeIdc: 140, conn: 180, pod: 140, ldb: 110, cred: 264 } as const;
const FLEX_KEYS = ['name'] as const;

/**
 * Credential 머리글 — 사용자 화면 Step 5 의 것 그대로. 열 이름만으로는 이 값이 무엇을
 * 고르는 것인지 안 읽히므로 (i) 로 한 번 설명한다.
 *
 * ⛔ 엔진을 열거하지 않는다: 목록(lib/types.ts NO_CREDENTIAL_ENGINES)은 엔진이 늘 때마다
 * 바뀌고 여기 적은 예시는 같이 안 바뀐다. 표가 이미 찍은 값(`불필요`)을 가리키는 편이
 * 언제나 참이다.
 */
const CREDENTIAL_HEAD = (
  <span className="inline-flex items-center gap-1">
    Credential
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
      <InfoCircleIcon
        className="h-3.5 w-3.5 text-[var(--pl-text-faint)]"
        aria-label="Credential 설명"
      />
    </Tooltip>
  </span>
);

/** IDC 는 이름 대신 접속 주소를 싣고 리전이 없다 — 열은 지우는 게 아니라 라벨이 바뀐다. */
const confirmedColumns = (isIdc: boolean): ConsoleTableColumn[] => [
  { key: 'name', label: isIdc ? '접속 주소' : 'Resource Name', width: COL_W.name, flex: true },
  {
    key: 'type',
    label: isIdc ? 'Database Type' : 'Database Type · Region',
    width: isIdc ? COL_W.typeIdc : COL_W.type,
  },
  { key: 'conn', label: '연결 상태', width: COL_W.conn },
  { key: 'pod', label: 'Pod 로그', width: COL_W.pod },
  { key: 'ldb', label: '연동 논리 DB', width: COL_W.ldb },
  { key: 'cred', label: 'Credential', width: COL_W.cred, head: CREDENTIAL_HEAD },
];

/** 네 값 중 하나만 한국어였다(Success / Failed / 진행 중 / Unknown): 같은 칸이 같은
 *  질문에 두 언어로 답하고 있었으므로, 사용자 화면 Step 5 가 쓰는 말로 맞춘다. */
function verdictPill(verdict: TcVerdict): ReactElement {
  if (verdict === 'SUCCESS') return <TcPill tone="ok" label="성공" />;
  if (verdict === 'FAIL') return <TcPill tone="err" label="실패" />;
  if (verdict === 'RUNNING') return <TcPill tone="warn" label="진행 중" />;
  if (verdict === 'PENDING') return <TcPill tone="off" label="대기" />;
  return <TcPill tone="off" label="미확인" />;
}

/**
 * 연결 상태 cell — 판정 알약 위, 실패 사유 아래. 한 칸이다.
 *
 * 사유는 제 열을 갖고 있었는데, 그 열은 여섯 행 중 두 행만 채우면서 174px 를 상시
 * 점유했다(사유는 실패한 행에만 있다). 사유는 판정과 나란한 사실이 아니라 판정에
 * 딸린 부연이므로, 열을 하나 더 쓰는 대신 판정 밑 한 단으로 내려온다.
 *
 * 한국어 라벨 + 원문 enum 2단은 그대로다 — admin 에서 원문은 검색·전달용 디버깅
 * 어휘라 hover 에 숨기지 않는다. 12종 허용목록 밖의 값은 원문만 중립으로.
 * 사유에 적색을 다시 칠하지 않는 것도 그대로: 판정은 바로 위 알약이 이미 말했다.
 */
function VerdictCell({
  verdict,
  fact,
}: {
  verdict: TcVerdict | undefined;
  fact: TcResourceFact | undefined;
}): ReactElement {
  if (!verdict) return <Dash />;
  const view = failReasonView(fact?.failReason);
  const raw = (
    <span
      className={cn(
        pipelineStyles.text.mono,
        'whitespace-nowrap text-[12px] text-[var(--pl-text-weak)]',
      )}
    >
      {view?.raw}
    </span>
  );
  return (
    <span className="flex flex-col items-start gap-1.5">
      {verdictPill(verdict)}
      {view
        && (view.label ? (
          <span className="flex flex-col" title={view.desc ?? undefined}>
            <span className="whitespace-nowrap text-[14px] text-[var(--pl-text-medium)]">
              {view.label}
            </span>
            {raw}
          </span>
        ) : (
          raw
        ))}
    </span>
  );
}

/**
 * Database Type · Region — 한 칸 두 단. 둘 다 리소스의 분류지 상태가 아니라 칩을 달지
 * 않는다. 리전은 한 토큰이라 줄바꿈하지 않는다('ap-northeast-' / '2' 는 둘로 읽힌다).
 * IDC 는 리전이 없어(온프렘) 타입 한 줄로 끝난다.
 */
function TypeRegionCell({
  type,
  region,
}: {
  type: string | null | undefined;
  region: string | null;
}): ReactElement {
  return (
    <span className="flex flex-col items-start">
      {/* The wire is lowercase (mysql·athena) — labelled the way the user screens label it. */}
      <span className="whitespace-nowrap text-[14px]">
        {type ? getDatabaseShortLabel(type) : <Dash />}
      </span>
      {region && (
        <span
          className={cn(
            pipelineStyles.text.mono,
            'whitespace-nowrap text-[12px] text-[var(--pl-text-weak)]',
          )}
        >
          {region}
        </span>
      )}
    </span>
  );
}

/** pod_id 는 캡처본을 조회하는 열쇠라 액션 바로 아래 그대로 적는다(오너 2026-08-21) —
 *  운영자가 클러스터에서 같은 이름을 찾는 값이므로 hover 에만 두지 않는다. */
function PodIdLine({ podId }: { podId: string }): ReactElement {
  return (
    <span
      className={cn(
        pipelineStyles.text.mono,
        'block truncate text-[12px] text-[var(--pl-text-weak)]',
      )}
      title={podId}
    >
      {podId}
    </span>
  );
}

/**
 * Pod 로그 cell — pod_id 와, 그 pod 의 로그를 여는 입구.
 *
 * 다섯 마디 중 어느 것을 할지는 `podLogState` 가 정한다(그 규칙과 근거는 거기에 적혀 있고,
 * 여기서는 문장과 픽셀만 고른다). 요지는 "pod 가 없다"는 계약이 POD_CREATION_FAILED 라고
 * 말해 줄 때만 하는 말이고, 나머지 빈칸은 "없음"이 아니라 "모름"이라는 것.
 *
 * 로그는 실행이 끝나는 시점에 캡처되므로 진행 중에는 열 것이 없다("수집 중 …").
 * 링크는 countLink 규칙 — 밑줄이 affordance 를 지고 색은 중립이다.
 */
const PodNote = ({ children }: { children: string }): ReactElement => (
  <span className="whitespace-nowrap text-[14px] text-[var(--pl-text-weak)]">{children}</span>
);

function PodLogCell({
  fact,
  onOpen,
}: {
  fact: TcResourceFact | undefined;
  onOpen: () => void;
}): ReactElement {
  const state = podLogState(fact);
  if (state === 'UNREPORTED') return <Dash />;
  if (state === 'BEFORE_POD') return <PodNote>Pod 생성 전</PodNote>;
  if (state === 'NO_POD') return <PodNote>Pod 없음</PodNote>;
  const podId = fact?.podId ?? '';
  return (
    <span className="flex max-w-[180px] flex-col items-start gap-1">
      {state === 'LOG' ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Pod 로그 조회 — ${podId}`}
          className={cn(opsStyles.countLink, 'whitespace-nowrap')}
        >
          로그 조회
        </button>
      ) : (
        <PodNote>수집 중 …</PodNote>
      )}
      <PodIdLine podId={podId} />
    </span>
  );
}

/**
 * 연동 논리 DB cell — 대상 건수 위, 제외 건수 아래. 두 열이던 것을 한 칸으로 합쳤다.
 *
 * 두 값은 같은 응답의 같은 게이트에서 온다(최신 실행이 SUCCESS 일 때만). 그래서 나란한 두
 * 열은 같은 사실을 두 번 넓게 벌려 놓은 것이었다. 다만 게이트가 같다고 두 필드가 늘 함께
 * 오는 것은 아니다 — 계약에서 둘 다 optional 이라 한쪽만 실린 행을 한 칸이 삼키면 안 된다.
 *
 * Contract-declared count — absent (no TC row / not a success) renders —, never 0.
 * 건수 링크 하나가 관리 모달을 연다(모달이 대상·제외 탭을 스스로 든다). 링크는 Step 6/7
 * 의 LogicalDbCountCell 규칙 — 밑줄이 affordance 를 지므로 행 끝에 관리 링크를 따로 달지
 * 않는다. 보고된 0 은 열 것이 없어 글자로 남는다.
 */
function LdbCell({
  row,
  verdict,
  onOpen,
}: {
  row: TcResultRow | undefined;
  verdict: TcVerdict | undefined;
  onOpen: () => void;
}): ReactElement {
  const included = ldbCount(row, 'inc', verdict);
  const excluded = ldbCount(row, 'exc', verdict);
  if (included == null && excluded == null) return <Dash />;
  return (
    <span className="flex flex-col items-start">
      {included == null ? null : included === 0 ? (
        <span className={opsStyles.countZero}>0개</span>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`연동 논리 DB ${included}개 보기`}
          className={opsStyles.countLink}
        >
          {included}
          <span className="text-[12px] font-medium">개</span>
        </button>
      )}
      {excluded != null && (
        <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          제외 {excluded}개
        </span>
      )}
    </span>
  );
}

/**
 * Resource Name — the Step 6·7 confirmed table's identity stack: a cluster or EC2 row
 * says WHAT it is in a tag above the name, and the name itself is truncated to one line
 * with the full value in a tip (which only appears once it is actually cut).
 *
 * `stackedIdentityLift`(PR #663) 는 여기서 쓰지 않는다 — 그 보정은 **한 줄짜리 이웃 칸**과
 * 이름을 같은 선에 두려고 스택을 12px 끌어올리는 장치인데, 이 표는 Resource ID 를 이름
 * 아래로 접으면서 모든 칸이 스택이 됐다. 이웃이 전부 여러 줄이면 `align-middle` 이 알아서
 * 같은 중심선을 만들고, 거기서 한쪽만 끌어올리면 오히려 어긋난다.
 */
function ResourceNameCell({
  value,
  resourceType,
}: {
  value: string | null;
  resourceType: string;
}): ReactElement {
  const cluster = isRdsCluster(resourceType);
  const ec2 = isEc2Instance(resourceType);
  const name = value ? (
    <Tooltip
      content={<IdentifierTip label="Resource Name" value={value} />}
      variant="value"
      size="md"
      // 폭 캡도 말줄임도 없다 — 자르는 것은 열(TD 가 clipper)이고, 열은 드래그로 넓어진다.
      // `…` 는 "여기서 줄였다"고 말하는데, 이 표에서 참인 것은 "다음 열 밑으로 이어진다"다
      // (오너 2026-08-25). `ResourceIdCell` 의 hardClip 과 같은 처방.
      triggerClassName="min-w-0 block w-full"
      truncatedOnly
    >
      <span className="block whitespace-nowrap font-mono text-[14px]">{value}</span>
    </Tooltip>
  ) : (
    <Dash />
  );
  if (!cluster && !ec2) return name;
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {cluster ? <RdsClusterTag /> : <Ec2InstanceTag />}
      {name}
    </span>
  );
}

/**
 * 접속 주소 — an IDC row's identity, in place of the Resource Name + Resource ID pair.
 * Neither of those exists for IDC: no scan names an on-prem DB (the service owner types
 * its address in), and its `resource_id` is an internal key that stays off the screen
 * (design-spec §8). Same cell the queue's IDC table uses, so 확정 정보 and 연동 요청
 * name a row the same way.
 */
function IdcIdentityCell({
  row,
}: {
  row: ConfirmedIntegrationResourceItem;
}): ReactElement {
  const view = toIdcResourceViewFromConfirmed(row);
  if (view.hosts.length === 0) return <Dash />;
  return <IdcEndpointCell hosts={view.hosts} kind={view.kind} />;
}

/** Row label for the two modals — the address for IDC, the name (then id) otherwise. */
const rowLabel = (row: ConfirmedIntegrationResourceItem): string =>
  row.resource_name
  || (row.idc_host_format != null
    ? toIdcResourceViewFromConfirmed(row).hosts.join(', ')
    : '')
  || row.resource_id;

export interface ConfirmedInfoCardProps {
  targetSourceId: number;
  /** IDC renders one 접속 주소 column instead of Resource Name · Resource ID · Region. */
  isIdc: boolean;
  /** Confirmed snapshot resources (fetched by TcTab). */
  rows: readonly ConfirmedIntegrationResourceItem[];
  /** Contract credential list (fetched by TcTab). */
  secrets: readonly SecretKey[];
  /** 논리 DB 건수 rows (latest-results), joined by resource_id. */
  tcResults: readonly TcResultRow[];
  /** 리소스별 연결 사실 — 판정·사유·pod (latest_version), joined by resource_id. */
  facts: ReadonlyMap<string, TcResourceFact>;
  /**
   * Credential 미설정 단위만 보기 — 밴드의 경고 줄이 소유하는 필터다. 표 자신의 세 축
   * (검색·Database Type·Region)과 달리 여기 컨트롤이 없는 이유는, 이 조건의 요약과 도달
   * 수단이 한 물건이어야 하기 때문이다(경고 줄의 링크가 곧 이 필터).
   */
  credMissingOnly: boolean;
  /** First tab load still in flight. */
  loading: boolean;
  /** Real snapshot fetch failure — a 404 "not confirmed yet" is not one. */
  failed: boolean;
  /** GET …/secrets failed — the credential modal says so instead of showing "0개". */
  secretsFailed: boolean;
  onReload: () => void;
}

export function ConfirmedInfoCard({
  targetSourceId,
  isIdc,
  rows,
  secrets,
  tcResults,
  facts,
  credMissingOnly,
  loading,
  failed,
  secretsFailed,
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const toast = usePlToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credRow, setCredRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  /** 로그 뷰어 대상 — pod 와 그 pod 가 검사한 리소스의 라벨. */
  const [podTarget, setPodTarget] = useState<{ podId: string; resourceLabel: string } | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  // Search · filter · page — the same three the Step 6·7 confirmed table carries. Confirmed
  // resources run to dozens, and laying them all out at once made whoever came here to assign
  // a Credential hunt for their own row by eye.
  const [query, setQuery] = useState('');
  const [dbTypeFilter, setDbTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [page, setPage] = useState(0);
  /** 펼쳐 둔 리전 단위 — 닫힘이 기본값이다(표는 단위 목록이지 데이터베이스 목록이 아니다). */
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const toggleUnit = (unitId: string): void =>
    setExpanded((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId],
    );

  // 드래그 폭은 이 화면 한 표의 것이다 — 셸은 공유하지만 저장 키와 내용 캡은 호출부가 준다.
  // flex 열의 폭은 세션 한정(ephemeral): 다음 방문에 되살리면 그 열이 싱크 역할을 잃는다.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:ops-tc-confirmed',
    ephemeralKeys: FLEX_KEYS,
  });

  const tcByResourceId = new Map(tcResults.map((row) => [row.resourceId, row]));

  // An option has to be the string the cell actually prints — put the wire value (mysql)
  // in the list and it never equals the cell's MySQL, so no row would ever pass.
  const dbTypeOf = (row: ConfirmedIntegrationResourceItem): string =>
    row.database_type ? getDatabaseShortLabel(row.database_type) : '';
  const dbTypeOptions = useMemo(() => uniqueSorted(rows.map(dbTypeOf)), [rows]);
  const regionOptions = useMemo(
    () => uniqueSorted(rows.map((row) => row.database_region ?? '')),
    [rows],
  );

  const filtered = useMemo(
    () =>
      filterConfirmedRows(rows, { query, dbType: dbTypeFilter, region: regionFilter }, dbTypeOf),
    [rows, query, dbTypeFilter, regionFilter],
  );

  // 페이지도 카운트도 행이 아니라 단위로 센다 — 접힌 Athena 리전은 데이터베이스를 몇 개
  // 담든 한 단위이고, 행으로 자르면 한 리전이 페이지 경계에서 갈려 부모 행이 두 번 그려진다.
  // Credential 필터는 단위 위에서 건다 — 배정은 단위(접힌 리전은 그 전부)의 속성이라
  // 행 단위로 거르면 한 리전의 데이터베이스 몇 개만 남아 부모 행이 반쪽으로 그려진다.
  const units = useMemo(() => {
    const all = toConfirmedUnits(filtered);
    return credMissingOnly ? all.filter(unitCredentialMissing) : all;
  }, [filtered, credMissingOnly]);
  const totalUnits = useMemo(() => toConfirmedUnits(rows).length, [rows]);
  const totalPages = Math.max(1, Math.ceil(units.length / PAGE_SIZE));
  // Narrowing the filter can push the current page past the end — used as-is it renders empty.
  const safePage = Math.min(page, totalPages - 1);
  const pageUnits = units.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const firstIndex = units.length === 0 ? 0 : safePage * PAGE_SIZE + 1;

  // 생성 시각 + 배정 건수 ride along in the assign modal: with 20+ credentials the
  // name alone rarely settles "which one is this", and those are the only other
  // facts available (SecretResponse + the confirmed snapshot join).
  const entries = credentialEntries(secrets, rows);
  const knownCredential = new Set(secrets.map((secret) => secret.name));

  const assignCredential = async (
    row: ConfirmedIntegrationResourceItem,
    credentialId: string,
  ): Promise<void> => {
    setSavingId(row.resource_id);
    try {
      await updateResourceCredential(targetSourceId, row.resource_id, credentialId || null);
      toast.show(credentialId ? 'Credential을 변경했습니다.' : 'Credential 연결을 해제했습니다.');
      setCredRow(null);
      onReload();
    } catch {
      // The modal stays open on failure so the choice is not lost.
      toast.show('Credential 변경에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };


  return (
    <section className={pipelineStyles.card.base} aria-label="확정 정보">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="install" size={18} className="text-[var(--pl-primary)]" />
            확정 정보
          </h2>
          {/* The cell affordance only appears on hover/focus, so the card says up
              front that the column is editable — otherwise the table reads as a
              read-only report and nobody hovers it. Primary color marks the one
              action in this sentence, not the whole sentence. */}
          <p className={opsStyles.cardDesc}>
            연동이 확정된 리소스별 연결 결과입니다. 순서는 연동 요청(Step 2) 표와 같으며,{' '}
            <b className="font-semibold text-[var(--pl-primary)]">
              Credential 값을 클릭하면 배정을 수정
            </b>
            할 수 있습니다.
          </p>
        </div>
        {/* The credential list is a lookup, not a status — it opens from here,
            where credentials are actually assigned. */}
        <PlButton variant="secondary" className="flex-none" onClick={() => setCredentialsOpen(true)}>
          Credential 목록
        </PlButton>
      </div>

      {loading ? (
        <div className="mt-3" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <span className={pipelineStyles.empty.icon}>
            <Icon name="install" size="xl" />
          </span>
          <p>확정된 연동 정보가 없습니다.</p>
          {failed && (
            <PlButton variant="secondary" size="sm" className="mt-3" onClick={onReload}>
              다시 시도
            </PlButton>
          )}
        </div>
      ) : (
        <>
          {/* Search + the two filters are a toolbar attached to the table — the same
              silhouette as Step 6·7 (pale band, rounded on top only, no gap below).
              A floating input cannot say what it is filtering. */}
          <div className={TOOLBAR}>
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={isIdc ? '호스트 · IP 검색' : 'Resource ID 또는 Resource Name 검색'}
              aria-label="확정 리소스 검색"
              className={SEARCH_INPUT}
            />
            <PlSelect
              aria-label="Database Type 필터"
              value={dbTypeFilter}
              onChange={(event) => {
                setDbTypeFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Database Type 전체</option>
              {dbTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </PlSelect>
            {/* No Region filter for IDC — an on-prem DB has no region, so the control
                could only ever offer an empty list. */}
            {!isIdc && (
              <PlSelect
                aria-label="Region 필터"
                value={regionFilter}
                onChange={(event) => {
                  setRegionFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">Region 전체</option>
                {regionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </PlSelect>
            )}
          </div>
          {/* The column order of steps 2·3·6·7: identity → attributes → verdict →
              그 결과로 알게 된 규모(논리 DB) → Credential (design: 최신 TC 결과 설계
              프레임 ①).

              열 10개가 프레임(1370px)보다 152px 넓어 Credential 이 접힌 채 열렸다.
              같은 질문에 답하는 값끼리 한 칸에 포개 6개로 줄인다 —
              정체(이름+ID) · 속성(타입+리전) · 판정(상태+사유) · 로그(입구+pod_id) ·
              규모(대상+제외). 열을 지운 게 아니라 겹친 것이라 사라진 사실은 없다
              (docs/ux/benchmark/tc-confirmed-columns.md). */}
          <div className={TABLE_FRAME}>
            <ConsoleTable columns={confirmedColumns(isIdc)} resize={resize} busy={loading}>
              <tbody className={idcStyles.table.body}>
                {pageUnits.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className={cn(CELL, 'py-10 text-center text-[var(--pl-text-weak)]')}
                    >
                      {FILTER_EMPTY_MESSAGE}
                    </td>
                  </tr>
                )}
                {pageUnits.map((unit) => {
                  // 판정·논리 DB 는 단위 id 로 조회한다 — Athena 는 그 id 가 리전이고,
                  // 데이터베이스 자기 id 로는 어느 결과에도 닿지 못한다(toConfirmedUnits).
                  const [row] = unit.members;
                  const tc = tcByResourceId.get(unit.unitId);
                  const fact = facts.get(unit.unitId);
                  const verdict = fact?.verdict;
                  const open = expanded.includes(unit.unitId);
                  // 건수가 온 키로 관리 화면도 연다 — 리전 단위 건수를 눌러 그 리전의
                  // 데이터베이스 한 건을 여는 일이 없도록. 이름표도 같이 리전으로 바꾼다:
                  // 리전 전체의 정책을 바꾸는 모달이 첫 데이터베이스의 이름을 달면, 화면이
                  // 말하는 범위와 저장이 바꾸는 범위가 어긋난다.
                  const openLdb = (): void =>
                    setLdbRow(
                      unit.folded
                        ? { ...row, resource_id: unit.unitId, resource_name: unit.unitId }
                        : row,
                    );
                  return (
                    <Fragment key={unit.unitId}>
                    <tr className={idcStyles.table.row}>
                      <td className={CLIP_CELL}>
                        {isIdc ? (
                          <IdcIdentityCell row={row} />
                        ) : (
                          /* 이름 위, Resource ID 아래 — 열 하나가 아니라 한 칸 두 단이다.
                             ID 는 지우지 않는다: ARN 이 같은 이름을 리전·계정으로 가르는
                             유일한 값이라, 열을 접어도 정체는 남아야 한다. */
                          <span className="flex min-w-0 flex-col items-start gap-1">
                            {/* 접힌 행은 리전을 가리킨다 — 리전에는 Resource Name 이 없으므로
                                이 칸이 펼침 손잡이와 엔진 이름을 대신 든다. 사용자 화면
                                Step 5 와 같은 문법이다. */}
                            {unit.folded ? (
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={`${row.database_region ?? ''} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
                                onClick={() => toggleUnit(unit.unitId)}
                                className="inline-flex items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)]"
                              >
                                <Icon
                                  name="chev-r"
                                  size="sm"
                                  className={cn(
                                    'flex-none text-[var(--pl-text-weak)] transition-transform',
                                    open && 'rotate-90',
                                  )}
                                />
                                <span className="font-mono text-[14px]">
                                  {row.database_type ? getDatabaseShortLabel(row.database_type) : '—'}
                                </span>
                              </button>
                            ) : (
                              <ResourceNameCell
                                value={row.resource_name || null}
                                resourceType={row.resource_type}
                              />
                            )}
                            {/* Step 1·2·3 grammar: truncated to `Prefix…` like the name
                                above it, tip on hover, copy button on row hover.
                                접힌 행이 다는 것은 결과가 실제로 키로 쓰는 id — 리전 id 다. */}
                            {unit.unitId && (
                              <ResourceIdCell
                                value={unit.unitId}
                                label="Resource ID"
                                // 폭 캡도 말줄임도 없다 — 자르는 것은 열이고, 열은 드래그로
                                // 넓어진다. 픽셀 캡이 남아 있으면 넓혀도 더 안 보이는 벽이 된다.
                                maxWidthClass="max-w-none"
                                hardClip
                              />
                            )}
                          </span>
                        )}
                      </td>
                      <td className={CELL}>
                        <TypeRegionCell
                          type={row.database_type}
                          region={isIdc ? null : row.database_region || null}
                        />
                      </td>
                      <td className={CELL}>
                        <VerdictCell verdict={verdict} fact={fact} />
                      </td>
                      <td className={CLIP_CELL}>
                        <PodLogCell
                          fact={fact}
                          onOpen={() =>
                            fact?.podId
                            && setPodTarget({
                              podId: fact.podId,
                              // 접힌 행의 pod 는 리전의 pod 다 — 뷰어 부제도 리전을 말해야 한다.
                              resourceLabel: unit.folded ? unit.unitId : rowLabel(row),
                            })
                          }
                        />
                      </td>
                      <td className={CELL}>
                        <LdbCell row={tc} verdict={verdict} onOpen={openLdb} />
                      </td>
                      <td className={CLIP_CELL}>
                        {/* Credential is addressed by resource id — no id, no assignment.
                            판정은 엔진이 한다 — Athena·DynamoDB·CosmosDB·BigQuery 는 IAM 으로
                            붙어 배정할 것이 없다. 접힘 여부로 가르던 때는 Athena 하나만
                            맞고 나머지 셋이 배정 없는 값으로 표시됐다(logic.ts 주석). */}
                        {!unitNeedsCredential(unit) ? (
                          <span className="whitespace-nowrap text-[12px] text-[var(--pl-text-weak)]">
                            불필요
                          </span>
                        ) : row.resource_id ? (
                          // 폭은 열이 진다 — 칸이 자기 폭을 다시 못 박으면 열을 넓혀도 안 커진다.
                          <div className="min-w-0">
                            {/* 값이 곧 트리거이고, 밑줄이 affordance 를 진다 — 사용자 화면
                                Step 5 의 Credential 칸과 같은 문법이다(`linkNeutral`). hover 에서만
                                드러나던 `수정` 힌트는 뺐다: 상시 밑줄이 이미 같은 말을 하고,
                                파란 힌트는 행마다 반복되면 표에서 가장 시끄러운 것이 된다.
                                말줄임도 없다 — 열이 자르고, 열은 드래그로 넓어진다. */}
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`${rowLabel(row)} Credential 수정 — 현재 ${row.credential_id || '미설정'}`}
                              disabled={savingId === row.resource_id}
                              onClick={() => setCredRow(row)}
                              title={row.credential_id || undefined}
                              className={cn(
                                idcStyles.triggerBtn.linkNeutral,
                                'max-w-full disabled:cursor-not-allowed disabled:opacity-50',
                              )}
                            >
                              {row.credential_id ? (
                                <span className="min-w-0 whitespace-nowrap font-mono">
                                  {row.credential_id}
                                </span>
                              ) : (
                                // 어휘는 밴드의 경고 줄과 같아야 한다 — 그 줄이 세는 것이
                                // 바로 이 값이다("Credential 미설정 N건").
                                <span className="font-sans">미설정</span>
                              )}
                            </button>
                            {/* An assignment the list no longer carries is stated, not
                                quietly folded in as one more selectable option. */}
                            {row.credential_id && !knownCredential.has(row.credential_id) && (
                              <span
                                className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'mt-1 block w-fit')}
                              >
                                목록에 없음
                              </span>
                            )}
                          </div>
                        ) : (
                          <Dash />
                        )}
                      </td>
                    </tr>
                    {/* 데이터베이스 목록 — 이름과, 그 이름이 무엇인지(Database Type 열이
                        Athena → Database 로 읽힌다). 나머지 칸은 비운다: 리전 행이 이미
                        답했고 데이터베이스마다 달라지는 값이 아니다. */}
                    {unit.folded
                      && open
                      && unit.members.map((db) => (
                        <tr key={db.resource_id} className={idcStyles.table.row}>
                          <td className={cn(CLIP_CELL, 'pl-[58px]')}>
                            <span className="flex min-w-0 flex-col items-start gap-1">
                              {db.resource_name ? (
                                <span className="block whitespace-nowrap font-mono text-[14px]">
                                  {db.resource_name}
                                </span>
                              ) : (
                                <Dash />
                              )}
                              <ResourceIdCell
                                value={db.resource_id}
                                label="Resource ID"
                                maxWidthClass="max-w-none"
                                hardClip
                              />
                            </span>
                          </td>
                          <td className={cn(CELL, 'whitespace-nowrap text-[var(--pl-text-weak)]')}>
                            {GROUPED_CHILD_KIND_LABEL}
                          </td>
                          <td className={CELL} colSpan={4} />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </ConsoleTable>
          </div>
          {/* Range and pager share a line — the grammar the Agent별 결과 list above uses. */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              {firstIndex}–{safePage * PAGE_SIZE + pageUnits.length} / {units.length}
              {units.length !== totalUnits && ` (전체 ${totalUnits})`}
            </p>
            <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
          <p className={cn(pipelineStyles.text.meta, 'mt-3.5')}>
            연결 상태(실패 사유 포함)·Pod 로그는 최근 연결 테스트가 리소스별로 보고한 사실이고,
            논리 DB 건수는 그중 성공한 리소스에만 표기합니다. 보고가 없는 리소스는 —(값 없음)으로
            두며, 임의로 성공 처리하지 않습니다. Pod 로그는 실행 완료 시점의 캡처본이고, 테스트 Pod
            생성 실패(POD_CREATION_FAILED)는 pod 가 뜨지 못해 로그가 없습니다. 논리 DB 건수를
            누르면 대상·제외 정책을 관리할 수 있습니다.
          </p>
        </>
      )}

      {credRow && (
        <CredentialAssignModal
          key={`cred-${credRow.resource_id}`}
          resourceLabel={rowLabel(credRow)}
          value={credRow.credential_id ?? ''}
          entries={entries}
          saving={savingId === credRow.resource_id}
          onSubmit={(next) => void assignCredential(credRow, next)}
          onClose={() => setCredRow(null)}
        />
      )}

      {credentialsOpen && (
        <TcCredentialModal
          secrets={secrets}
          rows={rows}
          failed={secretsFailed}
          onClose={() => setCredentialsOpen(false)}
        />
      )}

      {podTarget && (
        <TcPodLogModal
          targetSourceId={targetSourceId}
          podId={podTarget.podId}
          resourceLabel={podTarget.resourceLabel}
          onClose={() => setPodTarget(null)}
        />
      )}

      {ldbRow && (
        <LdbManageModal
          key={`ldb-${ldbRow.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={ldbRow.resource_id}
          resourceLabel={rowLabel(ldbRow)}
          databaseType={ldbRow.database_type}
          onClose={() => setLdbRow(null)}
          onSaved={onReload}
        />
      )}
    </section>
  );
}
