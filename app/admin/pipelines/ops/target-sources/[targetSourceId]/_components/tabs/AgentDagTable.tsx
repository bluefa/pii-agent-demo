'use client';

/**
 * 리소스(에이전트)별 최근 7일 DAG 표 — Airflow 확인 탭의 관측층.
 *
 * 표는 **사용자 화면 Step 1~7 이 쓰는 콘솔 표(시안 F) 그 자체**다 (오너 2026-08-25):
 * `ConsoleTable` 셸을 그대로 쓰고, 툴바 띠 + 프레임 + 페이저는 이 파일이 두른다
 * (`ConfirmedInfoCard` 와 같은 문법). 예전에는 admin 로컬 `opsStyles.table` 로 그려서
 * 열 드래그·시임 트레이서·덮어 자르는 셀 문법이 전부 빠져 있었다.
 *
 * 행 = dag-status 응답의 agent 하나. 열은 Resource Name · Resource ID · Database Type ·
 * Region · Monitoring 상태 (오너 2026-08-25) — Step 1 리소스 표와 같은 순서·같은 열 이름.
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
 * 연결이 정상이면 주간 관측으로 정상/이상을 판정한다. TC 탭의 판정과 출처가 다른
 * 값이라 (§06-5) raw 는 툴팁이 나른다.
 *
 * "DAG 상태 조회"(오너 08-21, "DB 보기"에서 rename)는 지속 선택이 아니라 one-shot
 * 진입이다: 주간 보드 패널을 그 에이전트로 스코프해서 연다. 보드가 스코프를 칩으로
 * 보여 주고 스스로 해제할 수 있으므로, 이 표는 선택 상태를 들고 있지 않는다.
 *
 * 에이전트가 1개뿐이어도 그린다 (2026-08-20 정정): 한 행이 요약의 반복일 거라는
 * 최초 판단이 실물 응답에서 깨졌다 — 요약은 resourceId·Region·그 리소스의 연결 상태를
 * 말하지 않아서, 표를 접으면 화면이 끝까지 어느 리소스 얘긴지 말하지 못한다.
 * 30개 규모(1801)를 위해 페이지 10; floor 를 명시해 마지막 페이지가 짧아도 아래
 * 내용이 따라 오르지 않는다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import { SegControl, type SegOption } from '@/app/admin/pipelines/_components/SegControl';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import {
  Dash,
  ResourceId,
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

const PAGE_SIZE = 10;

/** 행 높이 실측(한 줄 · `approvalCell`) × PAGE_SIZE — floor 명시용. */
const ROW_H = 53;

/**
 * 툴바 띠 + 프레임 = 표가 갖는 **하나의 흰 판**. 치수는 `ConfirmedInfoCard` 의 것과 같지만
 * 바닥이 다르다: 이 탭에는 카드가 없어서(오너 2026-08-25) 표가 놓이는 곳이 페이지 바닥
 * (#F4F4FB)이다. 그래서 판을 흰색으로 명시한다 — 카드 안이었을 때는 상속으로 흰색이었다.
 * 툴바도 같은 흰색이다: 카드 안에서 띠를 옅은 회색으로 깐 것은 흰 카드와 갈라 보이기
 * 위해서였는데, 옅은 회색(#F9FAFB)은 이 바닥과 사실상 같은 밝기라 판에 구멍처럼 남는다.
 */
const TOOLBAR =
  'flex flex-wrap items-center gap-2 rounded-t-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-4 py-3';
const TABLE_FRAME =
  'rounded-b-[10px] border border-t-0 border-[var(--pl-border)] bg-[var(--pl-bg-card)]';
/** 셸이 머리를 그리므로 남는 것은 본문 칸뿐 — 치수는 사용자 화면 표의 `approvalCell`. */
const CELL = cn(idcStyles.table.approvalCell, 'align-middle text-[14px] text-[var(--pl-text-strong)]');
/** 값을 덮어 자르는 칸(시안 F) — 넘치는 값이 말줄임 대신 다음 열 밑으로 이어진다. */
const CLIP_CELL = cn(CELL, idcStyles.table.consoleCell);

/**
 * 열 폭. flex 는 Resource ID 하나뿐이다 — 셸의 싱크(남는 폭을 흡수하는 열)는 마지막 flex
 * 열이 지므로, 행마다 임의로 길어지는 값(경로형 id, 120자 넘는 Azure ARM id)이 그 역할을
 * 가져가야 한다. 이름·타입·리전은 길이가 예측되는 값이라 폭을 고정한다.
 */
const COL_W = { name: 250, id: 300, dbType: 150, region: 170, address: 240, status: 230 } as const;
const FLEX_KEYS = ['id'] as const;

/**
 * 열 = 정체(이름 → id) → 속성(엔진 · 리전) → 판정(Monitoring 상태) → 진입.
 * 사용자 화면 Step 1 (`CandidateResourceTable`)의 순서 그대로이고, 열 이름도 그 표의 것을
 * 그대로 쓴다 — 같은 리소스가 화면마다 다른 이름의 칸에 담기면 다른 사실처럼 읽힌다.
 *
 * ⚠️ 08-21 의 "엔진 열은 IDC 에만"은 만료됐다 (오너 2026-08-25). 그 판단의 전제는 엔진 열이
 * 분수의 분모(논리 DB 수) 바로 옆에 서서 그 개수 얘기처럼 읽힌다는 것이었는데, 지금은
 * 속성 블록 안에 있고 분수는 Monitoring 상태 칸 안으로 들어갔다.
 *
 * IDC 는 리전이 없다 — 그 자리에 접속 주소가 선다(바닥에 놓인 기계에 리전은 없다).
 */
const agentColumns = (isIdc: boolean): ConsoleTableColumn[] => [
  { key: 'name', label: 'Resource Name', width: COL_W.name },
  { key: 'id', label: 'Resource ID', width: COL_W.id, flex: true },
  { key: 'dbType', label: 'Database Type', width: COL_W.dbType },
  {
    key: 'region',
    label: isIdc ? '접속 주소' : 'Region',
    width: isIdc ? COL_W.address : COL_W.region,
  },
  // 판정과 진입은 한 칸이다 (오너 2026-08-25) — 아래 WeeklyCell 참조.
  { key: 'status', label: 'Monitoring 상태', width: COL_W.status },
];

/**
 * 종합 상태 필터 (오너 08-21) — TcAgentResultList·DbWeeklyBoard 와 같은 문법:
 * SegControl, 전체가 먼저, 칩마다 개수, '그 외'는 있을 때만. 버킷은 알약(agentVerdict)의
 * tone 을 접은 것이라 칩과 알약이 다른 판정을 말할 수 없다 — 성공=정상(ok),
 * 실패=이상·연결 실패(err), 그 외=진행 중·대기·미확인·DAG 없음.
 */
type AgentFilter = 'ALL' | 'ok' | 'err' | 'other';

const FILTER_LABEL: Record<Exclude<AgentFilter, 'ALL'>, string> = {
  ok: '성공',
  err: '실패',
  other: '그 외',
};

const filterBucket = (agent: DagAgentSummary): Exclude<AgentFilter, 'ALL'> => {
  const { tone } = agentVerdict(agent);
  return tone === 'ok' ? 'ok' : tone === 'err' ? 'err' : 'other';
};

/**
 * Monitoring 상태 셀 — 판정 알약 + 최근 7일 분수, 그리고 **분수가 곧 진입**이다.
 *
 * `DAG 상태 조회` 열을 따로 두지 않는다 (오너 2026-08-25, "모니터링 상태와 DAG 상세를
 * 하나로"): 그 열은 모든 행에 같은 글자를 30번 찍으면서 140px 를 상시 점유했고, 무엇을
 * 여는지는 결국 옆 칸의 분수(그 에이전트의 논리 DB 52건)가 말하고 있었다. 그래서 여는
 * 것을 그 수 위에 얹는다 — 밑줄이 affordance 를 지고 색은 판정에 남는 규칙은 이 화면의
 * 카운트 줄(`실패 14`)이 이미 쓰는 문법이라, 표와 요약이 같은 제스처를 같은 모양으로 쓴다.
 *
 * 관측 DB 가 0개면 분수도 진입도 없다 — 알약('DAG 없음')이 이미 부재를 말했고, 빈 보드를
 * 여는 진입은 막다른 길이다(예전 열이 링크를 숨기던 조건 그대로).
 *
 * 미니 분포 바는 요약의 긴 스택바와 함께 걷혔다 (오너 2026-08-25, "긴 막대 바는 없애자").
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

export function AgentDagTable({
  data,
  onViewDbs,
  confirmed,
  isIdc,
}: AgentDagTableProps): ReactElement {
  const agents = useMemo(() => summarizeAgents(data), [data]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<AgentFilter>('ALL');

  // 드래그 폭은 이 화면 한 표의 것이다 — 셸은 공유하지만 저장 키는 호출부가 준다.
  // flex 열의 폭은 세션 한정: 다음 방문에 되살리면 그 열이 싱크 역할을 잃는다.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v2:ops-airflow-agents',
    ephemeralKeys: FLEX_KEYS,
  });

  const counts = useMemo(() => {
    const acc = { ok: 0, err: 0, other: 0 };
    for (const agent of agents) acc[filterBucket(agent)] += 1;
    return acc;
  }, [agents]);

  const options: SegOption<AgentFilter>[] = [
    { value: 'ALL', label: `전체 ${agents.length}` },
    { value: 'ok', label: `성공 ${counts.ok}` },
    { value: 'err', label: `실패 ${counts.err}` },
    // 활성인 동안은 개수가 0이 돼도 남는다 — 서 있던 칩이 발밑에서 사라지지 않게.
    ...(counts.other > 0 || filter === 'other'
      ? [{ value: 'other' as const, label: `그 외 ${counts.other}` }]
      : []),
  ];

  const changeFilter = (next: AgentFilter): void => {
    setFilter(next);
    setPage(0);
  };

  const visible = filter === 'ALL' ? agents : agents.filter((agent) => filterBucket(agent) === filter);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  // floor 는 필터 무관 전체 기준 — 칩을 누를 때마다 아래 내용이 오르내리면 안 된다.
  const floor = agents.length > PAGE_SIZE;
  const columns = agentColumns(isIdc);

  return (
    <section aria-label="리소스별 최근 7일 DAG">
      {/* 필터는 표에 붙은 툴바다 — 떠 있는 컨트롤은 무엇을 거르는지 말하지 못한다. */}
      <div className={TOOLBAR}>
        <SegControl
          ariaLabel="종합 상태 필터"
          options={options}
          value={filter}
          onChange={changeFilter}
        />
      </div>
      <div className={TABLE_FRAME} style={floor ? { minHeight: PAGE_SIZE * ROW_H } : undefined}>
        <ConsoleTable columns={columns} resize={resize}>
          <tbody className={idcStyles.table.body}>
            {pageRows.length === 0 && filter !== 'ALL' && (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cn(CELL, 'py-10 text-center text-[var(--pl-text-weak)]')}
                >
                  {FILTER_LABEL[filter]} 상태인 리소스가 없습니다.
                </td>
              </tr>
            )}
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
                  <td className={CLIP_CELL}>
                    <ResourceId value={agent.resourceId} />
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
                  {/* IDC 는 접속 주소, 그 밖은 리전. 리전은 응답의 gcpRegion 이 먼저고,
                      없으면 확정 정보에서 빌려 온다 — 빌려 온 칸은 툴팁이 출처를 밝힌다. */}
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

      {/* footer 는 항상 선다 (오너 08-21) — 표준 페이저 단독, 가운데 (다른 모든
          OpsPagination 사용처와 같은 문법). "1–3 / 3" 범위 텍스트는 기각됐다:
          개수는 위 카운트 줄이 이미 말하고, 분수 표기는 고장처럼 읽힌다. */}
      <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />
    </section>
  );
}
