// @vitest-environment jsdom
/**
 * 주간 보드 패널의 세 층(시안 C) — 머리·맥락 줄·푸터가 각자 한 가지만 말하는가.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';
import { DbWeeklyBoard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';

const db = (i: number, dagName: string | null): DagDatabaseStatus => ({
  databaseUri: `mysql://10.0.0.1:3306/db_${i}`,
  databaseName: `db_${i}`,
  schemaName: `db_${i}`,
  dagName,
  namespace: dagName ? 'composer-prod' : null,
  succeededThisWeek: dagName !== null,
  lastSuccessAt: null,
  days: [],
  // 이름 없는 행 = 성공 없음 = 읽을 실행 없음(null). 나머지는 0 을 포함한 수.
  latestTableCount: dagName ? i - 1 : null,
});

const response = (rows: number, nullDagAt: number | null = null): DagStatusResponse => ({
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus: 'HEALTHY',
  timezone: 'KST',
  agents: [
    {
      agentId: 'agent-1',
      resourceId: 'arn:aws:rds:ap-northeast-2:1:db:res-1',
      gcpRegion: null,
      connectionStatus: 'SUCCESS',
      databaseStatuses: Array.from({ length: rows }, (_, i) =>
        db(i + 1, i === nullDagAt ? null : `pii_scan_db_${i + 1}`),
      ),
      latestTableCountSum: 0,
    },
  ],
  latestTableCountSum: 0,
});

const mount = (data: DagStatusResponse, agentId: string | null = null) =>
  render(
    <DbWeeklyBoard
      data={data}
      initialFilter="ALL"
      initialAgentId={agentId}
      fetchedAt="2026-09-02T09:00:00+09:00"
      onClose={() => {}}
      onOpenDag={() => {}}
    />,
  );

describe('DbWeeklyBoard — 머리와 맥락 줄', () => {
  it('머리에는 에이전트 총계 문장이 없고, 스코프 배지는 제목 안에 선다', () => {
    const { container } = mount(response(3), 'agent-1');
    expect(container.textContent).not.toContain('에이전트 전체');
    const title = container.querySelector('#db-board-title');
    expect(title?.textContent).toContain('에이전트');
    expect(title?.querySelector('button[aria-label="에이전트 필터 해제"]')).not.toBeNull();
  });

  it('머리는 제목/설명 두 단 — 설명 줄이 스코프·시각을 말하고 툴바에는 조작만 있다', () => {
    const { container } = mount(response(3));
    expect(container.textContent).toContain('최근 7일 DAG 실행 기록 · KST ·');
    expect(container.textContent).toContain('조회');
    // 툴바(검색 인풋의 부모 줄)에는 스코프 태그도 시각도 없다.
    const toolbar = container.querySelector('input[type="search"]')?.parentElement;
    expect(toolbar?.textContent).not.toContain('최근 7일');
    expect(toolbar?.textContent).not.toContain('KST');
    const heads = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
    expect(heads).toEqual(['논리 DB', '최근 7일', '판정', '마지막 성공', 'Table 수', 'DAG']);
  });

  it('범례는 표 뒤에 선다', () => {
    const { container, getByText } = mount(response(3));
    const table = container.querySelector('table');
    const legend = getByText('판정 불가');
    expect(table).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING = 4: legend 가 table 뒤다.
    expect(table!.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('DbWeeklyBoard — 푸터', () => {
  it('한 페이지면 총계 한 줄뿐이다', () => {
    const { container } = mount(response(3));
    expect(container.textContent).toContain('전체 3');
    expect(container.querySelector('nav[aria-label="페이지"]')).toBeNull();
    expect(container.querySelector('select[aria-label="페이지당 행 수"]')).toBeNull();
  });

  it('여러 페이지면 범위 + pager + 페이지 크기가 선다', () => {
    const { container } = mount(response(25));
    expect(container.textContent).toContain('1–20 / 25');
    expect(container.querySelector('nav[aria-label="페이지"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="페이지당 행 수"]')).not.toBeNull();
  });
});

describe('DbWeeklyBoard — DAG 셀', () => {
  it('이름은 맨 글자, 진입은 상세 보기 단추 하나다', () => {
    const { container } = mount(response(2, 1));
    const open = container.querySelector('button[aria-label="pii_scan_db_1 DAG 상세 열기"]');
    expect(open?.textContent).toBe('상세 보기');
    // 이름은 단추가 아니다.
    expect(container.querySelector('span[title="pii_scan_db_1"]')?.textContent).toBe('pii_scan_db_1');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'pii_scan_db_1')).toBe(false);
  });

  it('Table 수 — null 은 「Table 개수 확인 안 됨」, 0 은 0 이다', () => {
    const { container } = mount(response(2, 1));
    const cells = Array.from(container.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelectorAll('td')[4].textContent,
    );
    // 문제 우선 정렬이라 성공 없음(db_2, null)이 먼저, 0 개를 읽은 실행(db_1)이 다음.
    expect(cells).toEqual(['Table 개수 확인 안 됨', '0']);
  });

  it('이름이 없는 행은 DAG 없음이고 그래도 열린다', () => {
    const { container } = mount(response(2, 1));
    expect(container.textContent).toContain('DAG 없음');
    expect(container.textContent).not.toContain('실행 기록 없음');
    expect(container.querySelector('button[aria-label="DAG 없음 DAG 상세 열기"]')?.textContent).toBe('상세 보기');
  });
});
