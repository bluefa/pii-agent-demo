'use client';

/**
 * 리소스(에이전트)별 주간 DAG 표 (L2, 시안 C) — UNHEALTHY 원인 추적의 중간층.
 *
 * 행 = dag-status 응답의 agent 하나. 확정 리소스와의 resourceId 조인(시안 C 원안)은
 * 이 PR 에서 보류다: 조인이 더할 identity 필드(resource_name·비-GCP region)는 §10 의
 * 미결 계약 질문(§06-4·5)이고, 이 응답이 스스로 보증하는 정체성은 resourceId 뿐이다 —
 * 계약에 없는 건 그리지 않는다. 그래서 이름줄은 resourceId 의 표시용 꼬리이고, 전체
 * 값은 mono 줄 툴팁에 있다. Region 열은 계약이 주는 gcpRegion 이 있을 때만 값이 선다.
 *
 * 연결 상태는 이 API(모니터링)의 값이라 열 이름이 출처를 밝힌다 — Test Connection
 * 탭의 최신 판정과 출처가 다르다(§06-5).
 *
 * "DB 보기"는 지속 선택이 아니라 one-shot 착지다: 아래 주간 보드를 그 에이전트로
 * 스코프해서 스크롤한다. 보드가 스코프를 칩으로 보여 주고 스스로 해제할 수 있으므로,
 * 이 표는 선택 상태를 들고 있지 않는다(두 컴포넌트의 상태 동기화를 만들지 않는 값싼 쪽).
 *
 * 에이전트가 1개뿐인 대상에선 이 층을 그리지 않는다 — 층은 데이터가 만들 때만
 * (마운트 판단은 ApprovalTab). 30개 규모(1801)를 위해 페이지 10; floor 를 명시해
 * 마지막 페이지가 짧아도 아래 보드가 따라 오르지 않는다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
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

const PAGE_SIZE = 10;

/** 행 높이 근사(2줄 정체성) × PAGE_SIZE — floor 명시용. */
const ROW_H = 65;

/** 주간 요약 셀 — 분수 + 미니 분포 바 (요약 밴드 스택바의 셀 번역, 같은 채움 문법). */
function WeeklyCell({ agent }: { agent: DagAgentSummary }): ReactElement {
  const pct = (count: number): string =>
    agent.dbTotal === 0 ? '0%' : `${(count / agent.dbTotal) * 100}%`;
  if (agent.dbTotal === 0) return <Dash />;
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
  /** 아래 주간 보드를 이 에이전트로 스코프해 착지시킨다. */
  onViewDbs: (agentId: string) => void;
}

export function AgentDagTable({ data, onViewDbs }: AgentDagTableProps): ReactElement {
  const agents = useMemo(() => summarizeAgents(data), [data]);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = agents.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const paged = totalPages > 1;

  return (
    <section className={pipelineStyles.card.base} aria-label="리소스별 주간 DAG">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn(opsStyles.cardTitle, 'flex items-baseline gap-2')}>
          리소스별 주간 DAG
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
              <th className={opsStyles.table.headCell}>Region</th>
              <th className={opsStyles.table.headCell}>연결 상태 (모니터링)</th>
              <th className={opsStyles.table.headCell}>주간 DAG</th>
              <th className={opsStyles.table.headCell} aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((agent) => {
              const pill = connPill(agent.connectionStatus);
              return (
                <tr key={agent.agentId}>
                  <td className={cn(opsStyles.table.cell, 'max-w-[360px]')}>
                    <p className="truncate text-[14px] font-medium text-[var(--pl-text-strong)]">
                      {agentDisplayName(agent.resourceId)}
                    </p>
                    <p
                      className="truncate font-mono text-[12px] text-[var(--pl-text-weak)]"
                      title={agent.resourceId}
                    >
                      {shortResourceId(agent.resourceId)}
                    </p>
                  </td>
                  <td className={opsStyles.table.cell}>
                    {agent.gcpRegion ? (
                      <span className={opsStyles.tag}>{agent.gcpRegion}</span>
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
                    <button
                      type="button"
                      onClick={() => onViewDbs(agent.agentId)}
                      className={opsStyles.detailLink}
                    >
                      DB 보기
                    </button>
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
