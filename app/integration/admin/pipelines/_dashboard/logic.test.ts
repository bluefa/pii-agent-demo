import { describe, expect, it } from 'vitest';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';
import {
  DASH_PAGE_SIZE,
  buildStatsDesc,
  filterByTarget,
  paginate,
  priorityRank,
  projectRows,
  sortByPriority,
} from '@/app/integration/admin/pipelines/_dashboard/logic';

/** Minimal PipelineSummary factory — only the fields the client logic reads. */
const row = (
  pipeline_id: number,
  status: PipelineStatus,
  target_source_id: string,
): PipelineSummary => ({
  pipeline_id,
  type: 'INSTALL',
  target_source_id,
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  status,
  done_task_count: 0,
  total_task_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
});

describe('priorityRank', () => {
  it('ranks FAILED→RUNNING→PENDING→rest', () => {
    expect(priorityRank('FAILED')).toBe(0);
    expect(priorityRank('RUNNING')).toBe(1);
    expect(priorityRank('PENDING')).toBe(2);
    expect(priorityRank('DONE')).toBe(3);
    expect(priorityRank('CANCELLED')).toBe(3);
  });
});

describe('sortByPriority', () => {
  it('orders by rank then pipeline_id desc within a group', () => {
    const rows = [
      row(10, 'DONE', 't'),
      row(20, 'FAILED', 't'),
      row(21, 'FAILED', 't'),
      row(30, 'PENDING', 't'),
      row(40, 'RUNNING', 't'),
      row(11, 'DONE', 't'),
    ];
    const ids = sortByPriority(rows).map((r) => r.pipeline_id);
    // FAILED(21,20) → RUNNING(40) → PENDING(30) → rest DONE(11,10)
    expect(ids).toEqual([21, 20, 40, 30, 11, 10]);
  });

  it('does not mutate the input array', () => {
    const rows = [row(1, 'DONE', 't'), row(2, 'FAILED', 't')];
    const before = rows.map((r) => r.pipeline_id);
    sortByPriority(rows);
    expect(rows.map((r) => r.pipeline_id)).toEqual(before);
  });
});

describe('filterByTarget', () => {
  const rows = [row(1, 'DONE', '101'), row(2, 'DONE', '2015'), row(3, 'DONE', '305')];

  it('substring-matches target_source_id', () => {
    expect(filterByTarget(rows, '01').map((r) => r.target_source_id)).toEqual(['101', '2015']);
  });

  it('trims the query and passes through when empty', () => {
    expect(filterByTarget(rows, '   ')).toHaveLength(3);
    expect(filterByTarget(rows, ' 305 ').map((r) => r.target_source_id)).toEqual(['305']);
  });
});

describe('projectRows', () => {
  it('filters then priority-sorts', () => {
    const rows = [
      row(1, 'DONE', '101'),
      row(2, 'FAILED', '102'),
      row(3, 'RUNNING', '201'),
    ];
    // q '10' keeps 101/102; sort → FAILED(102) then DONE(101)
    expect(projectRows(rows, '10').map((r) => r.pipeline_id)).toEqual([2, 1]);
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i, 'DONE', 't'));

  it('slices 5/page and reports pages', () => {
    const p1 = paginate(rows, 1);
    expect(p1.slice).toHaveLength(DASH_PAGE_SIZE);
    expect(p1.pages).toBe(3);
    expect(p1.total).toBe(12);
  });

  it('clamps an out-of-range page into [1,pages]', () => {
    expect(paginate(rows, 99).current).toBe(3);
    expect(paginate(rows, 0).current).toBe(1);
    expect(paginate(rows, 3).slice).toHaveLength(2);
  });

  it('always reports at least one page for an empty list', () => {
    const empty = paginate([], 1);
    expect(empty.pages).toBe(1);
    expect(empty.slice).toEqual([]);
  });
});

describe('buildStatsDesc', () => {
  it('uses the period label', () => {
    expect(buildStatsDesc('1d')).toBe(
      '최근 24시간(생성시간 기준) 실패·성공 집계 — 기간 필터와 동기화 · 동작 중은 현재 순간값',
    );
  });
});
