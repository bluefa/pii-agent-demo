'use client';

/**
 * 확정 정보 표 — the single per-resource table of this tab.
 *
 * 카드가 아니라 표다 (오너 2026-08-25). 이 탭은 카드 한 장(`연결 테스트`)이고, 밴드와
 * 이 표는 그 안의 두 절이다 — 같은 실행을 집계로 한 번, 리소스별 사실로 한 번 말하는
 * 것이라 제목도 테두리도 두 벌일 이유가 없다. 카드 껍데기는 `TcLatestRunCard` 가 든다.
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
 * contract's credential list, which the card header's 목록 link opens) and
 * 논리 DB 관리 (skip policy).
 *
 * Rows/secrets are fetched by TcTab and passed in, because the credential list modal
 * needs the same two datasets to answer "이 자격 증명이 몇 건에 배정됐나".
 *
 * An absent snapshot (404 before 연동 확정) is an empty state, not an error; a real
 * fetch failure adds a 다시 시도 affordance to that same empty state so the two are
 * never confused with "확정된 리소스가 0건".
 */
import { Fragment, useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { Pagination } from '@/app/components/ui/Pagination';
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
import { Icon } from '@/app/admin/pipelines/_components/icons';
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
import { CredentialAssignModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/CredentialAssignModal';
import {
  credentialEntries,
  ldbCount,
  podLogState,
  toConfirmedUnits,
  unitCredentialMissing,
  unitNeedsCredential,
  type TcResourceFact,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** 첫 페이지 크기 — 이후로는 푸터의 표시 건수 선택이 정한다(Step 1~7 과 같은 바). */
const DEFAULT_PAGE_SIZE = 10;

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

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
/** 표를 아래에서 닫는 것은 페이지 바다 — 그 바가 자기 옆선과 아래 라운드를 그리므로
 *  표는 곧은 아래 모서리로 끝나고 바와 같은 테두리 색을 든다(`framePaged`). */
const TABLE_FRAME = cn('mt-3', idcStyles.table.framePaged);
/** 셸이 머리를 그리므로 남는 것은 본문 칸뿐 — 치수는 사용자 화면 표의 `approvalCell`. */
const CELL = cn(idcStyles.table.approvalCell, 'align-middle text-[14px] text-[var(--pl-text-strong)]');
/** 값을 덮어 자르는 칸(시안 F) — 넘치는 값이 말줄임 대신 다음 열 밑으로 이어진다. */
const CLIP_CELL = cn(CELL, idcStyles.table.consoleCell);

/**
 * 열 폭.
 *
 * 정체(Resource Name · Resource ID)와 속성(Database Type · Region)은 각자 제 열이다
 * (오너 2026-08-25). #729 가 둘씩 한 칸에 포갠 것은 열 10개가 프레임보다 넓어서였는데,
 * 두 쌍만 푸는 8열은 합이 프레임 안에 든다 — 포개기를 유지할 이유가 사라졌다.
 *
 * ⚠️ 합은 실측 프레임(1320px @1568 viewport)보다 작아야 한다. 프레임은 `overflow-hidden`
 * 이라 넘치는 폭은 스크롤이 아니라 **잘림**이고, 잘리는 것은 마지막 열(Credential)이다.
 * 8열 합 1284 + 슬랙 36 → 싱크(id)가 가져간다. 열을 더 넓히려면 다른 열에서 빼야 한다.
 *
 * flex 는 **정체 두 열**이다. 셸의 문서가 권하는 짝(둘을 선언하면 한쪽을 끌 때 싱크가
 * 다른 쪽으로 넘어가 분할 창처럼 움직인다)이고, 행마다 임의로 길어지는 값도 이 둘뿐이다
 * (이름, ARN). flex 열의 width 는 폭이 아니라 **바닥값**이다.
 *
 * cred 264 는 오너가 못 박은 값이다 — 실제 store 이름 `kimcs-postgres-analytics-readonly`
 * 가 잘리지 않는 폭(PR #767). 나머지 열의 바닥은 자기 **머리글**이 안 잘리는 폭이다:
 * 값은 덮어 자르는 문법이 있지만 열 이름이 잘리면 표가 깨진 것처럼 읽힌다.
 */
const COL_W = {
  name: 170,
  id: 190,
  idcName: 240,
  type: 130,
  region: 120,
  conn: 170,
  pod: 130,
  ldb: 110,
  cred: 264,
} as const;
const FLEX_KEYS = ['name', 'id'] as const;

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
          해당 DB에 접속할 때 사용할 계정 정보예요. Credentials 메뉴에서 등록한 것 중에서
          고르고, 불필요로 표시된 대상은 지정하지 않아도 연결 테스트를 막지 않아요.
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

/**
 * 열 순서 — 오너가 못 박은 척추 다섯: 정체(이름·ID) → 판정 → 규모 → Credential
 * (2026-08-25). 이 다섯은 붙어 있어야 하므로 나머지는 그 뒤에 선다.
 *
 * 뒤에 남는 셋의 순서는 "부연의 순서"다: Pod 로그는 바로 앞 판정의 증거이고, Database
 * Type·Region 은 행이 무엇인지 가르는 분류라 가장 늦다. 예전에는 분류가 정체 바로 뒤에
 * 있었는데, 그 자리는 이 표를 여는 이유(어디가 실패했나)를 두 열 밀어내고 있었다.
 *
 * IDC 는 이름 대신 접속 주소 한 열을 싣는다 — Resource Name·ID 도 Region 도 없다(온프렘
 * DB 는 스캔이 이름 붙인 적이 없고 리전이 없다). 열을 숨기는 게 아니라 그 사실이 없다.
 */
const confirmedColumns = (isIdc: boolean): ConsoleTableColumn[] =>
  isIdc
    ? [
        { key: 'name', label: '접속 주소', width: COL_W.idcName, flex: true },
        { key: 'conn', label: '연결 상태', width: COL_W.conn },
        { key: 'ldb', label: '연동 논리 DB', width: COL_W.ldb },
        { key: 'cred', label: 'Credential', width: COL_W.cred, head: CREDENTIAL_HEAD },
        { key: 'pod', label: 'Pod 로그', width: COL_W.pod },
        { key: 'type', label: 'Database Type', width: COL_W.type },
      ]
    : [
        { key: 'name', label: 'Resource Name', width: COL_W.name, flex: true },
        { key: 'id', label: 'Resource ID', width: COL_W.id, flex: true },
        { key: 'conn', label: '연결 상태', width: COL_W.conn },
        { key: 'ldb', label: '연동 논리 DB', width: COL_W.ldb },
        { key: 'cred', label: 'Credential', width: COL_W.cred, head: CREDENTIAL_HEAD },
        { key: 'pod', label: 'Pod 로그', width: COL_W.pod },
        { key: 'type', label: 'Database Type', width: COL_W.type },
        { key: 'region', label: 'Region', width: COL_W.region },
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
 * **지면에는 원문 enum 만 선다** (오너 2026-08-25). 한국어 라벨을 그 위에 한 단 더 얹으면
 * 실패한 행마다 3단이 되어, 판정보다 사유가 더 커 보였다. 원문은 운영자가 grep 하고
 * 티켓에 붙이는 바로 그 문자열이므로 남기고, 뜻을 만드는 한국어 문장은 hover 로 미룬다
 * (필요할 때만 그린다). 12종 허용목록 밖의 값은 설명이 없으므로 tip 도 달지 않는다 —
 * 열리지 않는 트리거는 밑줄로 거짓말을 하게 된다.
 *
 * 사유에 적색을 다시 칠하지 않는 것은 그대로: 판정은 바로 위 알약이 이미 말했다.
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
          // 흰 면 + 그림자 + 윤곽선(`variant="value"`) — 표의 흰 바닥 위에서 상자가
          // 스스로 떠 있어야 하므로 세 가지가 다 필요하다.
          <Tooltip
            variant="value"
            size="lg"
            content={
              <>
                <span className={idcStyles.table.headerTipTitle}>{view.label}</span>
                {view.desc && (
                  <span className={cn(idcStyles.table.headerTipBody, 'mt-1.5')}>{view.desc}</span>
                )}
              </>
            }
            triggerClassName="min-w-0"
          >
            <span
              className={cn(
                pipelineStyles.text.mono,
                'cursor-help whitespace-nowrap text-[12px] text-[var(--pl-text-weak)] underline decoration-dotted underline-offset-2',
              )}
            >
              {view.raw}
            </span>
          </Tooltip>
        ) : (
          raw
        ))}
    </span>
  );
}

/**
 * Database Type — 분류지 상태가 아니라 칩을 달지 않는다. The wire is lowercase
 * (mysql·athena) — labelled the way the user screens label it.
 */
const TypeCell = ({ type }: { type: string | null | undefined }): ReactElement =>
  type ? <span className="whitespace-nowrap text-[14px]">{getDatabaseShortLabel(type)}</span> : <Dash />;

/** Region — 사용자 화면 확정 표와 같은 처방(mono·중간 잉크). 한 토큰이라 줄바꿈하지
 *  않는다('ap-northeast-' / '2' 는 둘로 읽힌다). */
const RegionCell = ({ region }: { region: string | null }): ReactElement =>
  region ? (
    <span
      className={cn(
        pipelineStyles.text.mono,
        'whitespace-nowrap text-[14px] text-[var(--pl-text-medium)]',
      )}
    >
      {region}
    </span>
  ) : (
    <Dash />
  );

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
 * 네 마디 중 어느 것을 할지는 `podLogState` 가 정한다(그 규칙과 근거는 거기에 적혀 있고,
 * 여기서는 문장과 픽셀만 고른다). 요지는 "pod 가 없다"는 계약이 POD_CREATION_FAILED 라고
 * 말해 줄 때만 하는 말이고, 나머지 빈칸은 "없음"이 아니라 "모름"이라는 것.
 *
 * pod 가 있으면 진행 중이라도 링크다 — 로그는 pod 가 뜬 순간부터 쌓인다.
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
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Pod 로그 조회 — ${podId}`}
        className={cn(opsStyles.countLink, 'whitespace-nowrap')}
      >
        로그 조회
      </button>
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
   * Credential 미설정 단위만 보기 — 밴드의 경고 줄이 소유하는 유일한 필터다. 표에 자기
   * 컨트롤이 없는 이유는 이 조건의 요약과 도달 수단이 한 물건이어야 하기 때문이다
   * (경고 줄의 링크가 곧 이 필터).
   */
  credMissingOnly: boolean;
  /** First tab load still in flight. */
  loading: boolean;
  /** Real snapshot fetch failure — a 404 "not confirmed yet" is not one. */
  failed: boolean;
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
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const toast = usePlToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credRow, setCredRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  /** 로그 뷰어 대상 — pod 와 그 pod 가 검사한 리소스의 라벨. */
  const [podTarget, setPodTarget] = useState<{ podId: string; resourceLabel: string } | null>(null);
  // 페이지만 남는다 — 검색·필터 두 축은 뺐다(오너 2026-08-25). 남은 거르기는 밴드의
  // 경고 줄이 거는 Credential 미설정 하나뿐이고, 표시 건수는 푸터가 정한다.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
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
  const columns = confirmedColumns(isIdc);

  // 페이지도 카운트도 행이 아니라 단위로 센다 — 접힌 Athena 리전은 데이터베이스를 몇 개
  // 담든 한 단위이고, 행으로 자르면 한 리전이 페이지 경계에서 갈려 부모 행이 두 번 그려진다.
  // Credential 필터는 단위 위에서 건다 — 배정은 단위(접힌 리전은 그 전부)의 속성이라
  // 행 단위로 거르면 한 리전의 데이터베이스 몇 개만 남아 부모 행이 반쪽으로 그려진다.
  const units = useMemo(() => {
    const all = toConfirmedUnits(rows);
    return credMissingOnly ? all.filter(unitCredentialMissing) : all;
  }, [rows, credMissingOnly]);
  const totalPages = Math.max(1, Math.ceil(units.length / pageSize));
  // Narrowing the filter can push the current page past the end — used as-is it renders empty.
  const safePage = Math.min(page, totalPages - 1);
  const pageUnits = units.slice(safePage * pageSize, safePage * pageSize + pageSize);

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
    <>
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
          {/* The column order of steps 2·3·6·7: identity → attributes → verdict →
              그 결과로 알게 된 규모(논리 DB) → Credential (design: 최신 TC 결과 설계
              프레임 ①).

              정체 두 열과 속성 두 열은 각자 선다(오너 2026-08-25). 판정+사유와
              로그+pod_id 는 그대로 한 칸 두 단이다 — 아래 단이 위 단의 부연이지 나란한
              사실이 아니고, 그 둘까지 풀면 10열이 되어 #729 가 접었던 폭 문제로 되돌아간다
              (docs/ux/benchmark/tc-confirmed-columns.md). */}
          <div className={TABLE_FRAME}>
            <ConsoleTable columns={columns} resize={resize} busy={loading}>
              <tbody className={idcStyles.table.body}>
                {pageUnits.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
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
                        ) : unit.folded ? (
                          /* 접힌 행은 리전을 가리킨다 — 리전에는 Resource Name 이 없으므로
                             이 칸이 펼침 손잡이와 엔진 이름을 대신 든다. 사용자 화면
                             Step 5 와 같은 문법이다. */
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
                      </td>
                      {/* Resource ID 는 제 열이다 — ARN 이 같은 이름을 리전·계정으로 가르는
                          유일한 값이라 이름과 나란히 선다. 접힌 행이 다는 것은 결과가 실제로
                          키로 쓰는 id — 리전 id 다. IDC 는 이 열이 아예 없다(내부 키라
                          화면에 올리지 않는다, design-spec §8). */}
                      {!isIdc && (
                        <td className={CLIP_CELL}>
                          {unit.unitId ? (
                            <ResourceIdCell
                              value={unit.unitId}
                              label="Resource ID"
                              // 폭 캡도 말줄임도 없다 — 자르는 것은 열이고, 열은 드래그로
                              // 넓어진다. 픽셀 캡이 남아 있으면 넓혀도 더 안 보이는 벽이 된다.
                              maxWidthClass="max-w-none"
                              hardClip
                            />
                          ) : (
                            <Dash />
                          )}
                        </td>
                      )}
                      <td className={CELL}>
                        <VerdictCell verdict={verdict} fact={fact} />
                      </td>
                      <td className={CELL}>
                        <LdbCell row={tc} verdict={verdict} onOpen={openLdb} />
                      </td>
                      <td className={CLIP_CELL}>
                        {/* Credential is addressed by resource id — no id, no assignment.
                            그래서 **못 고르는 것은 접힌 리전뿐**이다: 리전 한 행이 데이터베이스
                            여럿을 덮으므로 배정 대상이 하나로 정해지지 않는다. 엔진은 고를 수
                            있는지를 가르지 않는다 — 어느 DB든 지정할 수 있어야 한다(오너
                            2026-08-25). 엔진이 가르는 것은 **비어 있는 것이 문제인가** 하나이고,
                            그 답은 빈 값의 낱말이 진다(불필요 / 미설정). */}
                        {unit.folded ? (
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
                              aria-label={`${rowLabel(row)} Credential 수정 — 현재 ${row.credential_id || (unitNeedsCredential(unit) ? '미설정' : '불필요')}`}
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
                              ) : unitNeedsCredential(unit) ? (
                                // 어휘는 밴드의 경고 줄과 같아야 한다 — 그 줄이 세는 것이
                                // 바로 이 값이다("Credential 미설정 N건").
                                <span className="font-sans">미설정</span>
                              ) : (
                                // 없어도 정상인 엔진. 낱말은 정책을 말하고("안 해도 된다"),
                                // 밑줄은 여전히 할 수 있다고 말한다 — 둘은 다른 질문의 답이다.
                                <span className="font-sans">불필요</span>
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
                        <TypeCell type={row.database_type} />
                      </td>
                      {!isIdc && (
                        <td className={CELL}>
                          <RegionCell region={row.database_region || null} />
                        </td>
                      )}
                    </tr>
                    {/* 데이터베이스 목록 — 이름과, 그 이름이 무엇인지(Database Type 열이
                        Athena → Database 로 읽힌다). 나머지 칸은 비운다: 리전 행이 이미
                        답했고 데이터베이스마다 달라지는 값이 아니다. */}
                    {unit.folded
                      && open
                      && unit.members.map((db) => (
                        /* 이름·ID·타입 세 칸만 채우고 나머지는 부모 행이 이미 답했다.
                           칸은 열 목록을 그대로 따라 그린다 — 빈 칸을 `colSpan` 숫자 하나로
                           덮으면 열 순서가 바뀔 때 그 숫자만 안 따라와 표가 한 칸씩 밀린다. */
                        <tr key={db.resource_id} className={idcStyles.table.row}>
                          {columns.map((column) => {
                            if (column.key === 'name') {
                              return (
                                <td key={column.key} className={cn(CLIP_CELL, 'pl-[58px]')}>
                                  {db.resource_name ? (
                                    <span className="block whitespace-nowrap font-mono text-[14px]">
                                      {db.resource_name}
                                    </span>
                                  ) : (
                                    <Dash />
                                  )}
                                </td>
                              );
                            }
                            if (column.key === 'id') {
                              return (
                                <td key={column.key} className={CLIP_CELL}>
                                  <ResourceIdCell
                                    value={db.resource_id}
                                    label="Resource ID"
                                    maxWidthClass="max-w-none"
                                    hardClip
                                  />
                                </td>
                              );
                            }
                            if (column.key === 'type') {
                              return (
                                <td
                                  key={column.key}
                                  className={cn(CELL, 'whitespace-nowrap text-[var(--pl-text-weak)]')}
                                >
                                  {GROUPED_CHILD_KIND_LABEL}
                                </td>
                              );
                            }
                            return <td key={column.key} className={CELL} />;
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </ConsoleTable>
          </div>
          {/* Step 1~7 이 쓰는 그 푸터다 (오너 2026-08-25) — 표시 건수·범위·페이저가 한 바에
              들고, 바가 표를 아래에서 닫는다. 콘솔 표의 문자 크기는 14px 고정(size="md"). */}
          <Pagination
            size="md"
            page={safePage}
            pageSize={pageSize}
            totalCount={units.length}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              // 페이지 크기가 커지면 지금 페이지 번호가 끝을 넘길 수 있다 — 첫 장으로.
              setPage(0);
            }}
          />
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
    </>
  );
}
