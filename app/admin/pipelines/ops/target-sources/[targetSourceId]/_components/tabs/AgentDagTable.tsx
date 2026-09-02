'use client';

/**
 * 리소스(에이전트)별 최근 7일 DAG 표 — Airflow 확인 탭의 관측층.
 *
 * 표는 **사용자 화면 Step 1 리소스 표 그대로**다 (오너 2026-08-25): `ConsoleTable` 셸 +
 * 무윤곽 흰 본문 + `Pagination size="md"` 마감 바. 윤곽을 지는 것은 프레임과
 * 그 바뿐이고 표 자체는 맨몸이다 (`CandidateResourceTable` 의 실루엣).
 * 툴바는 없다 — Step 1 은 검색·필터가 그 자리에 있어 상단 라운드를 지지만, 이 표에는
 * 거를 것이 없어서(아래 참조) 프레임이 그 라운드를 진다(`framePaged`).
 *
 * 페이저는 **6행부터** 선다 (오너 2026-09-02, 시안 A). 리소스 다섯에 "1–5 / 5" 와 페이지
 * 크기 셀렉트가 붙으면 바가 표보다 많은 말을 한다 — Cloudscape Table 이 "5개 이하면
 * 페이지네이션 없음"으로 긋는 선이 그것이다. 바가 없는 표는 `frameClosed` 가 제 라운드로
 * 닫는다. 총계는 바가 사라져도 남아야 하므로 표 **위**의 카운터 줄(`리소스 N`)이 진다 —
 * `MonitoringEvidenceBody` 의 카운트 문법(라운드 15 R15-3: 12px 라벨 + 14px 굵은 수)
 * 그대로라, 바로 위의 논리 DB 줄과 같은 옷이다. 6행부터는 바가 밑에서 같은 수를 한 번
 * 더 말하지만, 그 바는 페이지 범위를 말하는 자리라 중복이 아니다.
 * ⚠️ 라운드 16 의 "1페이지 노출 유지" 판례는 필터가 있는 표의 것이었다 — 필터가 목록을
 * 한 페이지로 줄였을 때 바가 사라지면 필터가 걸렸는지 바가 말해 주지 않는다는 이유였고,
 * 이 표에는 필터가 없다(아래). 전제가 다르므로 그 판례는 여기에 걸리지 않는다.
 *
 * 행 높이는 `approvalCell` 의 py-4 그대로다 (오너 2026-09-02) — py-5 로 한 단 올려 세우던
 * 덮어쓰기를 걷었다. Step 1 표는 체크박스와 두 줄 정체성을 지고 있어 그 높이가 필요했고,
 * 이 표의 행은 한 줄뿐이다. 빌려 쓰는 것은 본문 래퍼(`CONNECTED_FRAME`)까지고, 높이는 셀
 * 토큰이 정한다.
 *
 * ⛔ 종합 상태 필터(전체/성공/실패 칩)는 걷혔다 (오너 2026-08-25). 30행짜리 표에서
 * 칩 세 개는 정렬 한 번으로 끝나는 일을 세 상태로 만들었다 — 그 자리는 이제 Monitoring
 * 상태 열의 정렬이 대신한다.
 *
 * 행 = dag-status 응답의 agent 하나. 열은 Resource Name · Resource ID · Database Type ·
 * Region · Monitoring 상태 — Step 1 리소스 표와 같은 순서·같은 열 이름.
 *
 * §10 이 리소스에 대해 보증하는 것은 `resourceId` 와 `gcpRegion` 뿐이라, 나머지 세 칸
 * (이름·엔진·비-GCP 리전)은 확정 정보와 resourceId 로 조인해서 채운다(agentFacts).
 * 조인이 빗나가면 그 칸만 대시로 서고 표는 그대로다 — 없는 값을 id 에서 지어내지 않는다.
 *
 * 열은 언제나 선다 (오너 2026-09-03: "Resource Name · Resource ID · Database Type · Region 은
 * 1행이어도 표현되어야 한다"). 확정 전 대상(스냅샷 404 → 빈 index)도 클라우드는 네 정체 열,
 * IDC 는 세 정체 열을 그대로 세우고 조인 칸은 대시로 둔다 — 대신 카운터 줄 오른쪽의 한 문장이
 * 그 대시가 왜 비었는지를 말한다(확정 정보가 채우는 값이고, 이 대상은 아직 확정 전이다).
 * ⛔ 2026-09-02 시안 A 의 "조인 열 접기"(확정 전이면 Resource ID 하나로 접는 안)는 09-03 에
 * 기각됐다: 열의 유무가 대상마다 갈리면 표를 두 벌로 읽어야 한다. 문장은 남는다 — 대시
 * 세 개가 조인이 깨진 것처럼 읽히는 문제는 문장이 푼다.
 * `null`(조회 중·조회 실패)에는 문장이 없다 — 아직 모르는 것과 없다고 답한 것은 다른 사실이다.
 *
 * 값의 문법은 확정 정보 표(WaitingApprovalTable)를 따른다 — Region 도 DB 도 맨 텍스트고,
 * 엔진 이름은 같은 `getDatabaseShortLabel` 로 쓴다. 한 화면 안에서 같은 사실이 자리마다
 * 다른 옷을 입으면 다른 사실처럼 읽힌다 (오너 08-20).
 *
 * 연결 상태 열은 Monitoring 상태 열에 접혔고 (오너 08-20), 그 자리에는 **종합
 * 상태 알약이 모든 행에** 선다 (오너 08-21, agentVerdict): 비정상만 표시하던 예외
 * 방식은 연결 성공 + 2/4 성공인 행을 아무것도 경고하지 않았다. 연결이 우선하고,
 * 연결이 정상이면 주간 관측으로 정상/확인 필요를 판정한다. TC 탭의 판정과 출처가 다른
 * 값이라 (§06-5) raw 는 툴팁이 나른다.
 *
 * 실패 판정 행은 첫 칸에 4px 레일을 진다 (오너 2026-08-25) — 알약이 행의 끝에 서 있어
 * 색이 읽는 방향의 마지막에야 도착하던 것을, 같은 색을 행의 시작으로 한 벌 옮겨 푼다.
 * 면(행 틴트)이 아닌 이유는 `verdictRail.failed` 에 적혀 있다.
 *
 * 에이전트가 1개뿐이어도 그린다 (2026-08-20 정정): 한 행이 요약의 반복일 거라는
 * 최초 판단이 실물 응답에서 깨졌다 — 요약은 resourceId·Region·그 리소스의 연결 상태를
 * 말하지 않아서, 표를 접으면 화면이 끝까지 어느 리소스 얘긴지 말하지 못한다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles, verdictRail } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { Pagination } from '@/app/components/ui/Pagination';
import { SortCaretIcon } from '@/app/components/ui/icons';
import { IDC_COLUMN_WIDTHS } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { CONNECTED_FRAME } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  agentVerdict,
  summarizeAgents,
  type DagAgentSummary,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';
import {
  agentResourceFacts,
  type ConfirmedIndex,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';

/** 셸이 머리를 그리므로 남는 것은 본문 칸뿐 — 치수는 사용자 화면 표의 `approvalCell`. */
const CELL = cn(idcStyles.table.approvalCell, 'align-middle text-[14px] text-[var(--pl-text-strong)]');
/** 값을 덮어 자르는 칸(시안 F) — 넘치는 값이 말줄임 대신 다음 열 밑으로 이어진다. */
const CLIP_CELL = cn(CELL, idcStyles.table.consoleCell);

/**
 * 아직 모르는 칸. `Dash` 는 이 표에서 「그 값이 없다」는 낱말이라(조인이 빗나갔거나 IDC
 * 리소스에 이름이 없거나), 확정 정보가 아직 오지 않은 칸에 그것을 쓰면 표가 없는 사실을
 * 단언하고 곧 조용히 값으로 바뀐다.
 *
 * 높이는 14px 값의 글자 높이다 — 행 높이는 이 칸이 잡지 않는다(같은 행의 논리 DB 수와
 * 판정 알약이 §10 에서 바로 와 실물로 서 있다). `StatusCardSkeleton` 의 규칙 그대로.
 */
function PendingFact({ width }: { width: number }): ReactElement {
  return (
    <span
      className={cn(opsStyles.skeletonBar, 'block h-[14px] rounded')}
      style={{ width }}
      aria-hidden
    />
  );
}

/**
 * Step 1 표의 본문 래퍼 **그대로** — 클래스를 베끼지 않고 그 표가 쓰는 상수를 그대로
 * 가져온다(`CONNECTED_FRAME`). 같아야 하는 것이 값이 아니라 정체라, Step 1 이 그 판을
 * 바꾸는 날 이 표도 같이 움직여야 한다. 행 높이는 얹지 않는다 — `approvalCell` 의 py-4 가
 * 그대로 행이다(머리 주석).
 */
const TABLE_BODY = CONNECTED_FRAME;

/** 페이저가 서는 최소 행수 — 이 수까지는 한눈에 다 보이고, 바는 말할 범위가 없다. */
const PAGER_FROM = 6;

/**
 * 열 폭. flex 는 하나뿐이다 — 셸의 싱크(남는 폭을 흡수하는 열)는 마지막 flex 열이 지므로,
 * 행마다 임의로 길어지는 값이 그 역할을 가져가야 한다. 클라우드는 경로형 id 가, IDC 는
 * 접속 주소(호스트·FQDN)가 그 값이다.
 */
const COL_W = { name: 250, id: 300, dbType: 150, region: 170, status: 230 } as const;
/** 관측 규모 열 — IDC 단계 표의 `연동 논리 DB` 와 같은 폭. 같은 것을 세는 열이다. */
const LDB_W = IDC_COLUMN_WIDTHS.logicalDb;
const CLOUD_FLEX = ['id'] as const;
const IDC_FLEX = ['endpoint'] as const;

/**
 * Monitoring 상태 정렬 — 이 표가 답하는 질문은 "무엇을 봐야 하나" 하나뿐이라, 거르는
 * 대신 **문제를 위로 올린다** (오너 2026-08-25, 필터 칩 폐기와 같은 지시).
 *
 * 두 방향뿐이고 원래 순서로는 돌아가지 않는다: 응답 순서(agent 배열)는 읽는 사람에게
 * 아무 뜻도 없어서, 끄는 affordance 를 세 번째 상태로 다는 값이 없다.
 */
type StatusSort = null | 'attention' | 'ok';

/**
 * 정렬 키 — 알약의 tone 을 그대로 쓴다. 칩과 알약이 다른 판정을 말할 수 없던 이유와 같다.
 * `TcTone` 으로 닫아 두면 fallback 이 필요 없고, 톤이 하나 늘면 런타임에 중간 등수로
 * 조용히 떨어지는 대신 컴파일이 막는다.
 */
const TONE_RANK: Record<TcTone, number> = { err: 0, warn: 1, off: 2, ok: 3 };

const sortRank = (agent: DagAgentSummary): number => TONE_RANK[agentVerdict(agent).tone];

export interface AgentDagTableProps {
  data: DagStatusResponse;
  /** 주간 보드 패널을 이 에이전트로 스코프해 연다 — 진입은 규모 열의 수 하나뿐이다. */
  onViewDbs: (agentId: string) => void;
  /**
   * 확정 정보 조인. §10 은 리소스에 대해 resourceId·gcpRegion 만 보증한다:
   * Resource Name·DatabaseType·리전(비-GCP)·IDC 접속 주소는 전부 여기서 온다.
   *
   * 세 값이 세 가지 일을 한다 — `undefined` 는 **아직 조회 중**이라 그 칸들이 자국으로
   * 서고, `null`(조회 실패)과 조인 실패는 종전대로 대시다. 앞의 둘을 한 값으로 접으면
   * 조회가 도는 동안 표가 「이 리소스에는 이름이 없다」고 말했다가 값을 채워 넣는다.
   * 비어 있다고 **답한** index(404 → 빈 Map)도 대시지만, 그때는 카운터 줄이 사유를
   * 말한다(머리 주석).
   */
  confirmed: ConfirmedIndex | null | undefined;
  /**
   * IDC 대상이면 정체 열이 통째로 갈린다 — 클라우드의 이름·id·리전 대신 IDC 단계 표
   * (`IdcResourceTable`)의 접속 주소 · Port · Database Type 이 선다 (오너 2026-08-26).
   */
  isIdc: boolean;
}

export function AgentDagTable({
  data,
  onViewDbs,
  confirmed,
  isIdc,
}: AgentDagTableProps): ReactElement {
  const agents = useMemo(() => summarizeAgents(data), [data]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<StatusSort>(null);

  // 확정 전 대상 — 스냅샷이 "없다"고 답했다(빈 index). 조인 칸이 전부 대시로 서는 이유를
  // 카운터 줄이 말한다. undefined(조회 중)도 null(조회 실패)도 그 답이 아니라 말하지 않는다.
  const prejoin = confirmed != null && confirmed.size === 0;
  // 확정 정보가 아직 안 온 동안 그 표가 빌려 오는 칸들은 자국으로 선다 — 대시가 아니라.
  const pending = confirmed === undefined;

  // 드래그 폭은 이 화면 한 표의 것이다 — 셸은 공유하지만 저장 키는 호출부가 준다.
  // flex 열의 폭은 세션 한정: 다음 방문에 되살리면 그 열이 싱크 역할을 잃는다.
  // 저장 키가 갈리는 이유는 열 자체가 갈려서다 — 한 키를 나눠 쓰면 IDC 의 Database Type
  // 폭(172)과 클라우드의 것(150)이 같은 슬롯을 놓고 덮어쓴다.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: isIdc ? 'pii:colw:v1:ops-airflow-agents-idc' : 'pii:colw:v2:ops-airflow-agents',
    ephemeralKeys: isIdc ? IDC_FLEX : CLOUD_FLEX,
  });

  const toggleSort = (): void => {
    setSort((prev) => (prev === 'attention' ? 'ok' : 'attention'));
    setPage(0);
  };

  /**
   * 정체 열은 대상이 어느 쪽이냐에 따라 통째로 갈린다 (오너 2026-08-26: "idc는 기존
   * step에서처럼 컬럼을 구성해").
   *
   * 클라우드는 Step 1 리소스 표의 열 이름을, IDC 는 IDC 단계 표(`IdcResourceTable`)의
   * 정체 3열을 그대로 쓴다 — 접속 주소(싱크) · Port · Database Type. 폭도 그 표에서
   * import 한다: 값을 베끼면 그 표가 폭을 바꾸는 날 여기만 옛 값으로 남는다.
   *
   * IDC 에 이름·id·리전이 없는 것은 생략이 아니라 사실이다. 스캔이 IDC 리소스에 이름을
   * 짓지 않고(주소가 정체다), 바닥에 놓인 기계에 리전은 없다. 단계 표들이 같은 이유로
   * 같은 열을 갖고 있다.
   *
   * ⚠️ 08-21 의 "엔진 열은 IDC 에만"은 만료됐다 (오너 2026-08-25). 그 판단의 전제는 엔진
   * 열이 분수의 분모(논리 DB 수) 바로 옆에 서서 그 개수 얘기처럼 읽힌다는 것이었는데,
   * 분수는 이제 없다.
   */
  const columns: ConsoleTableColumn[] = [
    ...(isIdc
      ? [
          { key: 'endpoint', label: '접속 주소', width: IDC_COLUMN_WIDTHS.endpoint, flex: true },
          { key: 'port', label: 'Port', width: IDC_COLUMN_WIDTHS.port },
          { key: 'dbType', label: 'Database Type', width: IDC_COLUMN_WIDTHS.dbType },
        ]
      : [
          { key: 'name', label: 'Resource Name', width: COL_W.name },
          { key: 'id', label: 'Resource ID', width: COL_W.id, flex: true },
          { key: 'dbType', label: 'Database Type', width: COL_W.dbType },
          { key: 'region', label: 'Region', width: COL_W.region },
        ]),
    // 규모가 판정 바로 앞에 선다 — 요약 카운트 줄의 순서(논리 DB → 성공 → 확인 필요)와
    // 같다. 시안 A 가 분수를 걷으면서 이 수까지 같이 잃었고, 그 바람에 정상 행에는
    // 진입이 하나도 남지 않았다 (오너 2026-08-26).
    { key: 'ldb', label: '논리 DB', width: LDB_W },
    {
      key: 'status',
      label: 'Monitoring 상태',
      width: COL_W.status,
      head: (
        <button
          type="button"
          onClick={toggleSort}
          // 세 상태를 다 말한다 — 화살표의 명암은 눈으로만 읽히는 채널이라, 지금 어느
          // 방향으로 서 있는지와 누르면 무엇이 되는지를 이름이 같이 진다.
          aria-label={
            sort === null
              ? 'Monitoring 상태로 정렬 — 확인 필요 먼저'
              : sort === 'attention'
                ? 'Monitoring 상태 — 확인 필요 먼저 정렬됨, 누르면 정상 먼저'
                : 'Monitoring 상태 — 정상 먼저 정렬됨, 누르면 확인 필요 먼저'
          }
          className="inline-flex cursor-pointer items-center gap-1.5 align-bottom"
        >
          Monitoring 상태
          {/* 이 열의 두 방향을 글리프의 두 방향에 맞춘다 — 확인 필요가 위로 오는 정렬이
              위 삼각형이다. 색은 currentColor 라 머리글 라벨과 한 잉크로 읽힌다. */}
          <SortCaretIcon
            className="flex-none"
            active={sort === null ? null : sort === 'attention' ? 'asc' : 'desc'}
          />
        </button>
      ),
    },
  ];

  // 정렬은 판정 하나만 본다 — 같은 판정 안의 순서는 응답 순서 그대로다(안정 정렬).
  const ordered = useMemo(() => {
    if (sort === null) return agents;
    const dir = sort === 'attention' ? 1 : -1;
    return [...agents].sort((a, b) => (sortRank(a) - sortRank(b)) * dir);
  }, [agents, sort]);

  // 다섯까지는 한 장이다 — 바도, 페이지도 없다.
  const paged = ordered.length >= PAGER_FROM;

  // 렌더는 clamp 로 안전하지만 `page` 자체를 되돌려 놓지 않으면 목록이 줄었다 늘 때
  // 누른 적 없는 자리로 돌아간다: 5페이지에서 12건짜리 응답이 오면 2페이지를 보여 주고,
  // 다음 응답이 30건이면 조용히 5페이지로 튄다.
  const safePage = Math.min(page, Math.max(0, Math.ceil(ordered.length / pageSize) - 1));
  if (page !== safePage) setPage(safePage);
  const pageRows = paged ? ordered.slice(safePage * pageSize, safePage * pageSize + pageSize) : ordered;

  const b = opsStyles.tcBand;

  return (
    <section aria-label="리소스별 최근 7일 DAG">
      {/* 카운터 줄 — 표의 주어. 바닥(gray-200) 위라 잉크는 `counts` 의 gray-600 이고, 오른쪽의
          대시 사유 문장도 같은 잉크다(weak 는 그 바닥에서 4.01 로 AA 아래 — 카운트 토큰의
          주석과 같은 실측). */}
      <div className={cn(b.counts, 'flex-wrap gap-y-1.5')}>
        <span className={b.countSeg}>
          리소스<b className={b.countValue}>{ordered.length.toLocaleString('ko-KR')}</b>
        </span>
        {prejoin && (
          <span className="ml-auto text-[12px] font-normal text-[var(--pl-gray-600)]">
            {isIdc
              ? '접속 주소 · Port · 엔진은 확정 정보가 채워요 — 이 대상은 아직 확정 전이에요'
              : '이름 · 엔진 · 리전은 확정 정보가 채워요 — 이 대상은 아직 확정 전이에요'}
          </span>
        )}
      </div>

      {/* 표는 맨몸이고 윤곽은 프레임이 진다 — 페이저가 있으면 프레임이 상단 라운드와 옆선을,
          바가 하단 라운드를 그리고(`framePaged` 의 계약), 없으면 프레임 혼자 닫는다
          (`frameClosed`). */}
      <div className={cn('mt-2', paged ? idcStyles.table.framePaged : idcStyles.table.frameClosed)}>
        <div className={TABLE_BODY} {...(pending ? { 'aria-busy': true } : {})}>
          <ConsoleTable columns={columns} resize={resize}>
            <tbody className={idcStyles.table.body}>
              {pageRows.map((agent) => {
                const facts = agentResourceFacts(agent.resourceId, confirmed);
                const verdict = agentVerdict(agent);
                const RAIL = verdict.tone === 'err' && verdictRail.failed;
                return (
                  <tr key={agent.agentId} className={idcStyles.table.row}>
                    {/* 실패 판정만 레일을 진다 — 침묵이 곧 정상이다(`verdictRail.target` 과 같은 규칙).
                        경고·부재(실행 시작·그 외·DAG 없음)는 볼 것이 아직 없는 상태라 부르지 않는다.
                        레일은 어느 배치에서든 **첫 칸**이 진다: 행이 시작하는 자리가 신호다. */}
                    {isIdc ? (
                      <>
                        {/* 주소가 IDC 리소스의 정체다 — 이름이 없어서 대신 쓰는 것이 아니라,
                            스캔이 이름을 짓지 않는 자리라 원래 주소가 이름이다. */}
                        <td className={cn(CLIP_CELL, RAIL)}>
                          {facts.address ? (
                            <span
                              className="inline-flex items-baseline gap-1.5"
                              title={facts.moreAddresses > 0 ? '확정 정보 기준 · 주소 여러 개' : '확정 정보 기준'}
                            >
                              <span className="font-mono text-[var(--pl-text-strong)]">
                                {facts.address}
                              </span>
                              {facts.moreAddresses > 0 && (
                                <span className="flex-none text-[12px] text-[var(--pl-text-weak)]">
                                  +{facts.moreAddresses}
                                </span>
                              )}
                            </span>
                          ) : pending ? (
                            <PendingFact width={132} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className={cn(CLIP_CELL, 'font-mono text-[var(--pl-text-medium)]')}>
                          {facts.port !== null ? (
                            facts.port
                          ) : pending ? (
                            <PendingFact width={40} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className={CLIP_CELL}>
                          {facts.databaseType ? (
                            <span title="확정 정보 기준">{getDatabaseShortLabel(facts.databaseType)}</span>
                          ) : pending ? (
                            <PendingFact width={56} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* 이름은 확정 정보의 것뿐이다 — §10 은 리소스 이름을 주지 않는다.
                            조인이 빗나가면 대시로 서고, id 열이 정체를 마저 진다. */}
                        <td className={cn(CLIP_CELL, RAIL)}>
                          {facts.name ? (
                            <span className="font-medium text-[var(--pl-text-strong)]" title="확정 정보 기준">
                              {facts.name}
                            </span>
                          ) : pending ? (
                            <PendingFact width={148} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                        {/* 축약하지 않는다 (오너 2026-08-25) — 값은 통째로 서고, 넘치면 다음 열이
                            덮어 자른다(`consoleCell`). 말줄임은 "여기서 줄였다"고 말해 버려서
                            열을 넓히면 더 보인다는 사실을 숨긴다; Step 6·7 표도 같은 규칙. */}
                        <td className={cn(CLIP_CELL, 'font-mono text-[var(--pl-text-medium)]')}>
                          {agent.resourceId}
                        </td>
                        <td className={CLIP_CELL}>
                          {/* 엔진 이름은 확정 정보 표와 같은 함수로 쓴다 — 한 화면에서 같은
                              리소스가 MYSQL 과 MySQL 로 갈라져 읽히면 다른 것처럼 보인다. */}
                          {facts.databaseType ? (
                            <span title="확정 정보 기준">{getDatabaseShortLabel(facts.databaseType)}</span>
                          ) : pending ? (
                            <PendingFact width={56} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                        {/* 리전은 응답의 gcpRegion 이 먼저고, 없으면 확정 정보에서 빌려 온다 —
                            빌려 온 칸은 툴팁이 출처를 밝힌다. */}
                        <td className={CLIP_CELL}>
                          {agent.gcpRegion ? (
                            <span>{agent.gcpRegion}</span>
                          ) : facts.region ? (
                            <span title="확정 정보 기준">{facts.region}</span>
                          ) : pending ? (
                            <PendingFact width={104} />
                          ) : (
                            <Dash />
                          )}
                        </td>
                      </>
                    )}
                    {/* 이 리소스가 무엇을 얼마나 보고 있는지, 그리고 **행의 유일한 창구**.
                        판정과 무관하게 서므로 정상 행도 열어 볼 수 있다. 0 이면 열 것이
                        없어 대시다. 열린 보드는 문제 우선으로 서고 확인 필요 칩을 갖는다. */}
                    <td className={CELL}>
                      {agent.dbTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => onViewDbs(agent.agentId)}
                          aria-label={`이 리소스의 논리 DB ${agent.dbTotal.toLocaleString('ko-KR')}건을 최근 7일 현황에서 보기`}
                          className="cursor-pointer whitespace-nowrap border-b border-current font-mono tabular-nums text-[var(--pl-text-strong)]"
                        >
                          {agent.dbTotal.toLocaleString('ko-KR')}
                        </button>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    {/* 판정 칸은 낱말 하나다 (오너 2026-08-26) — 수는 옆의 규모 열이
                        전부 진다. 한 칸이 판정과 수를 같이 지면, 분수를 걷어 낸 이유
                        (한 칸 안에서 두 가지 일)로 그대로 되돌아간다. 몇 개인지는 툴팁. */}
                    <td className={CELL}>
                      <span title={verdict.hint}>
                        <TcPill tone={verdict.tone} label={verdict.label} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ConsoleTable>
        </div>
      </div>

      {/* `size="md"` 는 콘솔 표 마운트의 규칙이다 — `Pagination.mounts.test.ts` 가 강제한다. */}
      {paged && (
        <Pagination
          size="md"
          page={safePage}
          pageSize={pageSize}
          totalCount={ordered.length}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(0);
          }}
        />
      )}
    </section>
  );
}
