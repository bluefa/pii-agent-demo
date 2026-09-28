// @vitest-environment jsdom
/**
 * 리소스별 DAG 표의 세 자리 — 페이저의 문턱, 카운터 줄, 확정 전 대상의 사유 문장.
 *
 * 셋 다 순수 함수가 아니라 배선이다: 페이저는 행수로 마운트 여부가 갈리고, 사유 문장은
 * `confirmed` 가 null 인지 빈 Map 인지로 갈린다 — 같은 "값 없음"이 두 화면이다. 열은 어느
 * 쪽이든 그대로 선다 (오너 2026-09-03).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DagAgentStatus, DagStatusResponse } from '@/lib/types/dag-status';
import { AgentDagTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AgentDagTable';
import { indexConfirmedResources } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';

const agent = (i: number): DagAgentStatus => ({
  agentId: `agent-${i}`,
  resourceId: `arn:aws:rds:ap-northeast-2:1:db:res-${i}`,
  gcpRegion: null,
  connectionStatus: 'SUCCESS',
  databaseStatuses: [
    {
      databaseUri: `mysql://10.0.0.${i}:3306/db_${i}`,
      databaseName: `db_${i}`,
      schemaName: `db_${i}`,
      dagName: `pii_scan_db_${i}`,
      namespace: 'composer-prod',
      succeededThisWeek: true,
      lastSuccessAt: null,
      days: [],
      latestTableCount: 10 * i,
    },
  ],
  latestTableCountSum: 10 * i,
});

const response = (count: number): DagStatusResponse => ({
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus: 'HEALTHY',
  timezone: 'KST',
  agents: Array.from({ length: count }, (_, i) => agent(i + 1)),
  latestTableCountSum: (10 * count * (count + 1)) / 2,
});

const headers = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('th')).map((th) => th.textContent?.trim() ?? '');

/** 본문 칸의 대시 수 — 카운터 줄의 사유 문장도 가운뎃줄을 품고 있어 칸만 센다. */
const cellDashes = (container: HTMLElement): number =>
  Array.from(container.querySelectorAll('td')).filter((td) => td.textContent === '—').length;

describe('AgentDagTable — 페이저와 카운터', () => {
  it('5행까지는 페이저 없이 카운터 줄만 총계를 말한다', () => {
    const { container } = render(
      <AgentDagTable data={response(5)} onViewDbs={() => {}} confirmed={null} isIdc={false} />,
    );
    expect(container.textContent).toContain('리소스5');
    // 페이지 크기 셀렉트는 Pagination 의 것뿐이다 — 없으면 바가 없다.
    expect(container.querySelector('select')).toBeNull();
  });

  it('6행부터 페이저가 선다 — 카운터 줄은 그대로', () => {
    const { container } = render(
      <AgentDagTable data={response(6)} onViewDbs={() => {}} confirmed={null} isIdc={false} />,
    );
    expect(container.textContent).toContain('리소스6');
    expect(container.querySelector('select')).not.toBeNull();
  });
});

const CLOUD_HEADS = ['Resource Name', 'Resource ID', 'Database Type', 'Region', '논리 DB', 'Table 수', 'Monitoring 상태'];

describe('AgentDagTable — 확정 정보 조인 열', () => {
  it('스냅샷이 비었다고 답하면(빈 index) 네 열은 그대로, 조인 칸은 대시, 사유 문장이 선다', () => {
    const { container } = render(
      <AgentDagTable
        data={response(2)}
        onViewDbs={() => {}}
        confirmed={indexConfirmedResources([])}
        isIdc={false}
      />,
    );
    expect(headers(container)).toEqual(CLOUD_HEADS);
    // 행마다 이름 · 엔진 · 리전 세 칸이 대시다 — 열은 접히지 않는다(오너 2026-09-03).
    expect(cellDashes(container)).toBe(6);
    expect(container.textContent).toContain('이름 · 엔진 · 리전은 확정 정보가 채워요');
  });

  it('IDC 는 정체 3열이 그대로 서고 사유 문장은 IDC 어휘다', () => {
    const { container } = render(
      <AgentDagTable
        data={response(1)}
        onViewDbs={() => {}}
        confirmed={indexConfirmedResources([])}
        isIdc
      />,
    );
    expect(headers(container)).toEqual(['접속 주소', 'Port', 'Database Type', '논리 DB', 'Table 수', 'Monitoring 상태']);
    expect(cellDashes(container)).toBe(3);
    expect(container.textContent).toContain('접속 주소 · Port · 엔진은 확정 정보가 채워요');
  });

  it('스냅샷을 기다리는 동안(undefined) 조인 칸은 자국이고 문장은 없다', () => {
    const { container } = render(
      <AgentDagTable data={response(1)} onViewDbs={() => {}} confirmed={undefined} isIdc={false} />,
    );
    expect(headers(container)).toEqual(CLOUD_HEADS);
    expect(cellDashes(container)).toBe(0);
    expect(container.querySelectorAll('td .animate-pulse')).toHaveLength(3);
    expect(container.textContent).not.toContain('확정 정보가 채워요');
  });

  it('조회가 실패하면(null) 열은 전부 서고 조인 칸은 대시, 문장은 없다', () => {
    const { container } = render(
      <AgentDagTable data={response(1)} onViewDbs={() => {}} confirmed={null} isIdc={false} />,
    );
    expect(headers(container)).toEqual(CLOUD_HEADS);
    expect(cellDashes(container)).toBe(3);
    expect(container.textContent).not.toContain('확정 정보가 채워요');
  });
});
