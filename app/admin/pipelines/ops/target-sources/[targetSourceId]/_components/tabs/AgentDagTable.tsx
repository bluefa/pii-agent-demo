'use client';

/**
 * 리소스(에이전트)별 최근 7일 DAG 표 — Airflow 확인 탭의 관측층.
 *
 * 표는 **사용자 화면 Step 1 리소스 표 그대로**다 (오너 2026-08-25): `ConsoleTable` 셸 +
 * 무윤곽 흰 본문(행 py-5) + `Pagination size="md"` 마감 바. 윤곽을 지는 것은 프레임과
 * 그 바뿐이고 표 자체는 맨몸이다 (`CandidateResourceTable` 의 실루엣).
 * 툴바는 없다 — Step 1 은 검색·필터가 그 자리에 있어 상단 라운드를 지지만, 이 표에는
 * 거를 것이 없어서(아래 참조) 프레임이 그 라운드를 진다(`framePaged`).
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
 * Step 1 표의 본문 래퍼 **그대로** — 클래스를 베끼지 않고 그 표가 쓰는 상수를 그대로
 * 가져온다(`CONNECTED_FRAME`). 같아야 하는 것이 값이 아니라 정체라, Step 1 이 그 판을
 * 바꾸는 날 이 표도 같이 움직여야 한다.
 *
 * 얹는 것은 행 높이 하나뿐 — `approvalCell` 의 py-4 에서 한 단 올린 py-5 (Step 1 이 그렇게
 * 서 있다). `:not([colspan])` 가드는 Step 1 에서 온 그대로다 — 이 표에는 빈 상태 줄이
 * 없지만(호출부가 `agents.length > 0` 으로 막는다), 상수를 빌려 쓰는 쪽이 원본의 조건을
 * 깎을 이유가 없다.
 */
const TABLE_BODY = cn(CONNECTED_FRAME, '[&_td:not([colspan])]:py-5');

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
  /**
   * 주간 보드 패널을 이 에이전트로 스코프해 연다. 필터까지 받는 이유는 한 행에 진입이
   * 둘이어서다 — 규모(전부 보기)와 확인 필요(문제만 보기)는 다른 질문이고, 여는 쪽이
   * 무엇을 보여 주기로 했는지 알지 보드가 추측할 일이 아니다.
   */
  onViewDbs: (agentId: string, filter: 'ALL' | 'attention') => void;
  /**
   * 확정 정보 조인 — 없으면(로딩·조회 실패·조인 실패) 그 칸들은 대시로 선다.
   * §10 은 리소스에 대해 resourceId·gcpRegion 만 보증한다: Resource Name·DatabaseType·
   * 리전(비-GCP)·IDC 접속 주소는 전부 여기서 온다.
   */
  confirmed: ConfirmedIndex | null;
  /**
   * IDC 대상이면 정체 열이 통째로 갈린다 — 클라우드의 이름·id·리전 대신 IDC 단계 표
   * (`IdcResourceTable`)의 접속 주소 · Port · Database Type 이 선다 (오너 2026-08-26).
   */
  isIdc: boolean;
}

/**
 * Monitoring 상태 셀 (시안 A, 오너 2026-08-26) — 판정 알약 + **확인해야 할 개수 하나**,
 * 그리고 그 수가 곧 진입이다.
 *
 * 분수(`34/52 성공`)를 버린 이유는 한 칸 안에서 극성이 뒤집혔기 때문이다: 알약은 잘못된
 * 것을 부르고(확인 필요) 분수는 잘된 것을 셌다. 정작 필요한 수 — 확인해야 할 18 — 은
 * 어디에도 없어서 빼야 나왔고, 밑줄은 성공한 34 위에 앉아 목적지를 잘못 말했고,
 * 정상 행은 `정상 52/52 성공`으로 같은 사실을 두 번 말했다. 열을 세로로 훑으면 마지막
 * 낱말이 매 행 `성공`이었다.
 *
 * 지금은 바로 위 요약 카운트 줄과 같은 문법이다 — 버킷마다 자기 수를 세고, 분수가 없고,
 * 극성이 한 방향. 이 셀은 그 줄의 리소스 단위 축소판이다. 활자도 그 줄의 것을 쓴다
 * (`countValue` 14px bold tabular): 알약 12px 과 갈려서 무엇이 판정이고 무엇이 그 크기인지
 * 형태가 말한다.
 *
 * 수는 판정을 낸 함수가 같이 낸다(`verdict.count`) — 셀이 같은 셈을 두 번째로 하다가
 * 어긋날 길을 없앤다. 그래서 수가 서는 행은 정확히 알약이 '확인 필요'인 행이다.
 * 나머지 판정(정상 · 실행 시작 · 그 외 · DAG 없음 · 연결 실패)은 알약만 세운다 —
 * 셀 것이 없다는 것이 곧 볼 것이 없다는 뜻이 된다.
 *
 * 판정은 호출부에서 받는다 — 같은 행의 실패 레일이 같은 값을 읽어야 하고, 레일과 알약이
 * 서로 다른 판정을 말할 수 있는 길은 아예 없는 편이 낫다(정렬 키가 tone 을 쓰는 것과 같은 이유).
 */
function VerdictCell({
  verdict,
  onViewDbs,
}: {
  verdict: ReturnType<typeof agentVerdict>;
  onViewDbs: () => void;
}): ReactElement {
  const count = verdict.count ?? 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span title={verdict.hint}>
        <TcPill tone={verdict.tone} label={verdict.label} />
      </span>
      {count > 0 && (
        <button
          type="button"
          onClick={onViewDbs}
          aria-label={`이 리소스의 확인 필요 논리 DB ${count.toLocaleString('ko-KR')}건을 최근 7일 현황에서 보기`}
          // 색은 판정에 남고 밑줄이 affordance 를 진다 — 카운트 줄의 `실패 14` 와 같은 규칙.
          className="cursor-pointer whitespace-nowrap border-b border-current text-[14px] font-bold tabular-nums text-[var(--pl-err-text)]"
        >
          {count.toLocaleString('ko-KR')}
        </button>
      )}
    </span>
  );
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

  // 렌더는 clamp 로 안전하지만 `page` 자체를 되돌려 놓지 않으면 목록이 줄었다 늘 때
  // 누른 적 없는 자리로 돌아간다: 5페이지에서 12건짜리 응답이 오면 2페이지를 보여 주고,
  // 다음 응답이 30건이면 조용히 5페이지로 튄다.
  const safePage = Math.min(page, Math.max(0, Math.ceil(ordered.length / pageSize) - 1));
  if (page !== safePage) setPage(safePage);
  const pageRows = ordered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section aria-label="리소스별 최근 7일 DAG">
      {/* 표는 맨몸이고 윤곽은 프레임과 페이저 바가 진다 — 프레임이 상단 라운드와 옆선을,
          바가 하단 라운드를 그린다(`framePaged` 의 계약). */}
      <div className={idcStyles.table.framePaged}>
        <div className={TABLE_BODY}>
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
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className={cn(CLIP_CELL, 'font-mono text-[var(--pl-text-medium)]')}>
                          {facts.port === null ? <Dash /> : facts.port}
                        </td>
                        <td className={CLIP_CELL}>
                          {facts.databaseType ? (
                            <span title="확정 정보 기준">{getDatabaseShortLabel(facts.databaseType)}</span>
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
                          ) : (
                            <Dash />
                          )}
                        </td>
                      </>
                    )}
                    {/* 이 리소스가 무엇을 얼마나 보고 있는지, 그리고 **모든 행의 창구**.
                        판정과 무관하게 서므로 정상 행도 열어 볼 수 있다 — 확인 필요의 수는
                        문제만 열고, 이 수는 전부 연다. 0 이면 열 것이 없어 대시다. */}
                    <td className={CELL}>
                      {agent.dbTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => onViewDbs(agent.agentId, 'ALL')}
                          aria-label={`이 리소스의 논리 DB ${agent.dbTotal.toLocaleString('ko-KR')}건을 최근 7일 현황에서 보기`}
                          className="cursor-pointer whitespace-nowrap border-b border-current font-mono tabular-nums text-[var(--pl-text-strong)]"
                        >
                          {agent.dbTotal.toLocaleString('ko-KR')}
                        </button>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={CELL}>
                      <VerdictCell
                        verdict={verdict}
                        onViewDbs={() => onViewDbs(agent.agentId, 'attention')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ConsoleTable>
        </div>
      </div>

      {/* `size="md"` 는 콘솔 표 마운트의 규칙이다 — `Pagination.mounts.test.ts` 가 강제한다. */}
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
    </section>
  );
}
