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
 * 에이전트가 1개뿐이어도 그린다 (2026-08-20 정정): 한 행이 요약의 반복일 거라는
 * 최초 판단이 실물 응답에서 깨졌다 — 요약은 resourceId·Region·그 리소스의 연결 상태를
 * 말하지 않아서, 표를 접으면 화면이 끝까지 어느 리소스 얘긴지 말하지 못한다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { Pagination } from '@/app/components/ui/Pagination';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import {
  Dash,
  TcPill,
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
 * Step 1 표의 본문 래퍼 그대로 — 무윤곽 흰 판, 행 높이는 `approvalCell` 의 py-4 에서
 * 한 단 올린 py-5 (오너 지시로 Step 1 이 그렇게 서 있다). `:not([colspan])` 가드는
 * 스팬 셀(빈 상태 줄)이 이 선택자에 걸리지 않게 한다.
 */
const TABLE_BODY = cn('overflow-hidden bg-white', '[&_td:not([colspan])]:py-5');

/**
 * 열 폭. flex 는 Resource ID 하나뿐이다 — 셸의 싱크(남는 폭을 흡수하는 열)는 마지막 flex
 * 열이 지므로, 행마다 임의로 길어지는 값(경로형 id)이 그 역할을 가져가야 한다.
 */
const COL_W = { name: 250, id: 300, dbType: 150, region: 170, address: 240, status: 230 } as const;
const FLEX_KEYS = ['id'] as const;

/**
 * Monitoring 상태 정렬 — 이 표가 답하는 질문은 "무엇을 봐야 하나" 하나뿐이라, 거르는
 * 대신 **문제를 위로 올린다** (오너 2026-08-25, 필터 칩 폐기와 같은 지시).
 *
 * 두 방향뿐이고 원래 순서로는 돌아가지 않는다: 응답 순서(agent 배열)는 읽는 사람에게
 * 아무 뜻도 없어서, 끄는 affordance 를 세 번째 상태로 다는 값이 없다.
 */
type StatusSort = null | 'attention' | 'ok';

/** 정렬 키 — 알약의 tone 을 그대로 쓴다. 칩과 알약이 다른 판정을 말할 수 없던 이유와 같다. */
const TONE_RANK: Record<string, number> = { err: 0, warn: 1, off: 2, ok: 3 };

const sortRank = (agent: DagAgentSummary): number => TONE_RANK[agentVerdict(agent).tone] ?? 2;

/** 정렬 글리프 — 활성 방향만 진하고 나머지는 흐리다(둘 다 흐리면 미정렬). */
function SortCaret({ sort }: { sort: StatusSort }): ReactElement {
  const on = 'fill-[var(--pl-text-strong)]';
  const off = 'fill-[var(--pl-text-faint)]';
  return (
    <svg width={8} height={12} viewBox="0 0 8 12" aria-hidden focusable="false" className="flex-none">
      <path d="M4 1 7 5H1z" className={sort === 'attention' ? on : off} />
      <path d="M4 11 1 7h6z" className={sort === 'ok' ? on : off} />
    </svg>
  );
}

export interface AgentDagTableProps {
  data: DagStatusResponse;
  /** 주간 보드 패널을 이 에이전트로 스코프해 연다. */
  onViewDbs: (agentId: string) => void;
  /**
   * 확정 정보 조인 — 없으면(로딩·조회 실패·조인 실패) 그 칸들은 대시로 선다.
   * §10 은 리소스에 대해 resourceId·gcpRegion 만 보증한다: Resource Name·DatabaseType·
   * 리전(비-GCP)·IDC 접속 주소는 전부 여기서 온다.
   */
  confirmed: ConfirmedIndex | null;
  /** IDC 대상이면 리전 자리에 접속 주소가 선다 — 바닥에 놓인 기계에 리전은 없다. */
  isIdc: boolean;
}

/**
 * Monitoring 상태 셀 — 판정 알약 + 최근 7일 분수, 그리고 **분수가 곧 진입**이다.
 *
 * `DAG 상태 조회` 열을 따로 두지 않는다 (오너 2026-08-25, "모니터링 상태와 DAG 상세를
 * 하나로"): 그 열은 모든 행에 같은 글자를 30번 찍으면서 140px 를 상시 점유했고, 무엇을
 * 여는지는 결국 옆 칸의 분수(그 에이전트의 논리 DB 52건)가 말하고 있었다. 그래서 여는
 * 것을 그 수 위에 얹는다 — 밑줄이 affordance 를 지고 색은 판정에 남는 규칙은 이 화면의
 * 카운트 줄(`실패 14`)이 이미 쓰는 문법이다.
 *
 * 관측 DB 가 0개면 분수도 진입도 없다 — 알약('DAG 없음')이 이미 부재를 말했고, 빈 보드를
 * 여는 진입은 막다른 길이다.
 */
function WeeklyCell({
  agent,
  onViewDbs,
}: {
  agent: DagAgentSummary;
  onViewDbs: () => void;
}): ReactElement {
  const verdict = agentVerdict(agent);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span title={verdict.hint}>
        <TcPill tone={verdict.tone} label={verdict.label} />
      </span>
      {agent.dbTotal > 0 && (
        <button
          type="button"
          onClick={onViewDbs}
          aria-label={`이 리소스의 논리 DB ${agent.dbTotal.toLocaleString('ko-KR')}건을 최근 7일 현황에서 보기`}
          className="cursor-pointer whitespace-nowrap font-mono text-[12px] tabular-nums text-[var(--pl-text-strong)]"
        >
          <b className="border-b border-current font-semibold">
            {agent.succeeded.toLocaleString('ko-KR')}/{agent.dbTotal.toLocaleString('ko-KR')}
          </b>{' '}
          성공
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
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v2:ops-airflow-agents',
    ephemeralKeys: FLEX_KEYS,
  });

  const toggleSort = (): void => {
    setSort((prev) => (prev === 'attention' ? 'ok' : 'attention'));
    setPage(0);
  };

  /**
   * IDC 는 리전이 없다 — 그 자리에 접속 주소가 선다(바닥에 놓인 기계에 리전은 없다).
   *
   * ⚠️ 08-21 의 "엔진 열은 IDC 에만"은 만료됐다 (오너 2026-08-25). 그 판단의 전제는 엔진
   * 열이 분수의 분모(논리 DB 수) 바로 옆에 서서 그 개수 얘기처럼 읽힌다는 것이었는데,
   * 지금은 속성 블록 안에 있고 분수는 Monitoring 상태 칸 안으로 들어갔다.
   */
  const columns: ConsoleTableColumn[] = [
    { key: 'name', label: 'Resource Name', width: COL_W.name },
    { key: 'id', label: 'Resource ID', width: COL_W.id, flex: true },
    { key: 'dbType', label: 'Database Type', width: COL_W.dbType },
    {
      key: 'region',
      label: isIdc ? '접속 주소' : 'Region',
      width: isIdc ? COL_W.address : COL_W.region,
    },
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
          <SortCaret sort={sort} />
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

  const safePage = Math.min(page, Math.max(0, Math.ceil(ordered.length / pageSize) - 1));
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
                return (
                  <tr key={agent.agentId} className={idcStyles.table.row}>
                    {/* 이름은 확정 정보의 것뿐이다 — §10 은 리소스 이름을 주지 않는다.
                        조인이 빗나가면 대시로 서고, id 열이 정체를 마저 진다. */}
                    <td className={CLIP_CELL}>
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
                      {isIdc ? (
                        facts.address ? (
                          <span
                            className="inline-flex items-baseline gap-1.5"
                            title={facts.moreAddresses > 0 ? '확정 정보 기준 · 주소 여러 개' : '확정 정보 기준'}
                          >
                            <span className="font-mono text-[12px] text-[var(--pl-text-medium)]">
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
                        )
                      ) : agent.gcpRegion ? (
                        <span>{agent.gcpRegion}</span>
                      ) : facts.region ? (
                        <span title="확정 정보 기준">{facts.region}</span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={CELL}>
                      <WeeklyCell agent={agent} onViewDbs={() => onViewDbs(agent.agentId)} />
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
