'use client';

/**
 * 리소스(에이전트)별 최근 7일 DAG 표 (L2, 시안 C) — UNHEALTHY 원인 추적의 중간층.
 *
 * 행 = dag-status 응답의 agent 하나. §10 이 리소스에 대해 보증하는 것은 resourceId 와
 * gcpRegion 뿐이라, 리전(비-GCP)·DatabaseType 은 확정 정보와 resourceId 로 조인해서
 * 채운다(agentFacts). 조인이 빗나가면 그 칸만 대시로 서고 표는 그대로다.
 *
 * 값의 문법은 확정 정보 표(WaitingApprovalTable)를 따른다 — Region 도 DB 도 맨 텍스트고,
 * 엔진 이름은 같은 `getDatabaseShortLabel` 로 쓴다. 한 화면 안에서 같은 사실이 자리마다
 * 다른 옷을 입으면 다른 사실처럼 읽힌다 (오너 08-20).
 *
 * 연결 상태는 이 API(모니터링)의 값이라 열 이름이 출처를 밝힌다 — Test Connection
 * 탭의 최신 판정과 출처가 다르다(§06-5).
 *
 * "DB 보기"는 지속 선택이 아니라 one-shot 진입이다: 주간 보드 패널을 그 에이전트로
 * 스코프해서 연다. 보드가 스코프를 칩으로 보여 주고 스스로 해제할 수 있으므로,
 * 이 표는 선택 상태를 들고 있지 않는다(두 컴포넌트의 상태 동기화를 만들지 않는 값싼 쪽).
 *
 * 에이전트가 1개뿐이어도 그린다 (2026-08-20 정정): 한 행이 요약 밴드의 반복일 거라는
 * 최초 판단이 실물 응답에서 깨졌다 — 밴드는 resourceId·Region·그 리소스의 연결 상태를
 * 말하지 않아서, 표를 접으면 화면이 끝까지 어느 리소스 얘긴지 말하지 못한다.
 * 30개 규모(1801)를 위해 페이지 10; floor 를 명시해 마지막 페이지가 짧아도 아래
 * 요약 라인이 따라 오르지 않는다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  shortResourceId,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  agentDisplayName,
  connPill,
  summarizeAgents,
  type DagAgentSummary,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';
import {
  agentResourceFacts,
  type ConfirmedIndex,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';

const PAGE_SIZE = 10;

/** 행 높이 근사(2줄 정체성) × PAGE_SIZE — floor 명시용. */
const ROW_H = 65;

/** 최근 7일 요약 셀 — 분수 + 미니 분포 바 (요약 밴드 스택바의 셀 번역, 같은 채움 문법). */
function WeeklyCell({ agent }: { agent: DagAgentSummary }): ReactElement {
  const pct = (count: number): string =>
    agent.dbTotal === 0 ? '0%' : `${(count / agent.dbTotal) * 100}%`;
  // 논리 DB 가 하나도 없는 리소스 — 대시로 두면 "값을 못 읽었다"로 읽힌다. 여기서
  // 0 은 조회 실패가 아니라 **걸린 DAG 가 없다**는 확정된 사실이라 문장으로 말한다.
  if (agent.dbTotal === 0) {
    // 12px — 이 열의 본문(`6/6 성공`)이 12px 라 같은 단에 선다.
    return <span className="text-[12px] text-[var(--pl-text-weak)]">DAG 없음</span>;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-[var(--pl-text-strong)]">
        <b className="font-semibold">{agent.succeeded.toLocaleString('ko-KR')}</b>/
        {agent.dbTotal.toLocaleString('ko-KR')} 성공
      </span>
      <span className="flex h-1.5 w-16 flex-none overflow-hidden rounded-full" aria-hidden>
        <span style={{ width: pct(agent.succeeded) }} className="bg-[var(--pl-ok)]" />
        <span style={{ width: pct(agent.failed) }} className="bg-[var(--pl-err)]" />
        {agent.running > 0 && (
          <span style={{ width: pct(agent.running) }} className="bg-[var(--pl-warn)]" />
        )}
        {/* 미스케줄(+미지 값)은 부재 — 요약 밴드와 같은 점선. */}
        {agent.rest > 0 && (
          <span
            style={{ width: pct(agent.rest) }}
            className="self-center border-t-2 border-dashed border-[var(--pl-border-strong)]"
          />
        )}
      </span>
    </span>
  );
}

export interface AgentDagTableProps {
  data: DagStatusResponse;
  /** 주간 보드 패널을 이 에이전트로 스코프해 연다. */
  onViewDbs: (agentId: string) => void;
  /**
   * 확정 정보 조인 — 없으면(로딩·조회 실패·조인 실패) 그 칸들은 대시로 선다.
   * §10 은 리소스에 대해 resourceId·gcpRegion 만 보증한다: 리전(비-GCP)·DatabaseType·
   * IDC 접속 주소는 전부 여기서 온다.
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

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = agents.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const paged = totalPages > 1;

  return (
    <section className={pipelineStyles.card.base} aria-label="리소스별 최근 7일 DAG">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn(opsStyles.cardTitle, 'flex items-baseline gap-2')}>
          리소스별 최근 7일 DAG
          <span className="text-[16px] font-medium text-[var(--pl-text-weak)] tabular-nums">
            {agents.length.toLocaleString('ko-KR')}
          </span>
        </h2>
      </div>

      <div
        className="mt-2 overflow-x-auto"
        style={paged ? { minHeight: PAGE_SIZE * ROW_H } : undefined}
      >
        <table className={opsStyles.table.base}>
          <thead>
            <tr>
              <th className={opsStyles.table.headCell}>리소스</th>
              <th className={opsStyles.table.headCell}>{isIdc ? '접속 주소' : 'Region'}</th>
              <th className={opsStyles.table.headCell}>DB</th>
              <th className={opsStyles.table.headCell}>연결 상태 (모니터링)</th>
              <th className={opsStyles.table.headCell}>최근 7일 DAG</th>
              <th className={opsStyles.table.headCell} aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((agent) => {
              const pill = connPill(agent.connectionStatus);
              const facts = agentResourceFacts(agent.resourceId, confirmed);
              return (
                <tr key={agent.agentId}>
                  <td className={cn(opsStyles.table.cell, 'max-w-[360px]')}>
                    <p
                      className="truncate text-[14px] font-medium text-[var(--pl-text-strong)]"
                      title={agent.resourceId}
                    >
                      {agentDisplayName(agent.resourceId)}
                    </p>
                    {/* 경로형 id 라야 두 줄이 서로 다른 말을 한다. IDC 처럼 구분자가 없는
                        id 는 이름줄과 축약줄이 같은 문자열이 되므로 둘째 줄을 접는다 —
                        같은 값을 두 번 찍으면 행이 고장 난 것처럼 읽힌다. */}
                    {shortResourceId(agent.resourceId) !== agentDisplayName(agent.resourceId) && (
                      <p
                        className="truncate font-mono text-[12px] text-[var(--pl-text-weak)]"
                        title={agent.resourceId}
                      >
                        {shortResourceId(agent.resourceId)}
                      </p>
                    )}
                  </td>
                  {/* IDC 는 접속 주소, 그 밖은 리전. 리전은 응답의 gcpRegion 이 먼저고,
                      없으면 확정 정보에서 빌려 온다 — 빌려 온 칸은 툴팁이 출처를 밝힌다. */}
                  <td className={cn(opsStyles.table.cell, 'max-w-[220px]')}>
                    {isIdc ? (
                      facts.address ? (
                        <span
                          className="inline-flex items-baseline gap-1.5"
                          title={facts.moreAddresses > 0 ? '확정 정보 기준 · 주소 여러 개' : '확정 정보 기준'}
                        >
                          <span className="truncate font-mono text-[12px] text-[var(--pl-text-medium)]">
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
                      <span className="truncate">{agent.gcpRegion}</span>
                    ) : facts.region ? (
                      <span className="truncate" title="확정 정보 기준">
                        {facts.region}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className={opsStyles.table.cell}>
                    {/* 엔진 이름은 확정 정보 표와 같은 함수로 쓴다 — 한 화면에서 같은
                        리소스가 MYSQL 과 MySQL 로 갈라져 읽히면 다른 것처럼 보인다. */}
                    {facts.databaseType ? (
                      <span title="확정 정보 기준">
                        {getDatabaseShortLabel(facts.databaseType)}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className={opsStyles.table.cell}>
                    {/* 미지의 enum 은 '미확인'으로 접고 raw 는 툴팁 채널에만. */}
                    <span title={pill.raw ? `connectionStatus: ${pill.raw}` : undefined}>
                      <TcPill tone={pill.tone} label={pill.label} />
                    </span>
                  </td>
                  <td className={opsStyles.table.cell}>
                    <WeeklyCell agent={agent} />
                  </td>
                  <td className={cn(opsStyles.table.cell, 'text-right')}>
                    {/* 볼 DB 가 없으면 링크도 없다 — 빈 보드를 여는 진입은 막다른 길이다. */}
                    {agent.dbTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => onViewDbs(agent.agentId)}
                        className={opsStyles.detailLink}
                      >
                        DB 보기
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paged && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
            {(safePage * PAGE_SIZE + 1).toLocaleString('ko-KR')}–
            {(safePage * PAGE_SIZE + pageRows.length).toLocaleString('ko-KR')} /{' '}
            {agents.length.toLocaleString('ko-KR')}
          </p>
          <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />
        </div>
      )}
    </section>
  );
}
