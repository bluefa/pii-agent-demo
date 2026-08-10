import { describe, expect, it } from 'vitest';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';
import {
  DASH_PAGE_SIZE,
  buildStatsDesc,
  filterBySearch,
  paginate,
  projectRows,
} from '@/app/admin/pipelines/_dashboard/logic';

/** Minimal PipelineSummary factory — only the fields the client logic reads. */
const row = (
  pipeline_id: number,
  status: PipelineStatus,
  target_source_id: string,
  service: { service_code?: string; service_name?: string } = {},
): PipelineSummary => ({
  pipeline_id,
  type: 'INSTALL',
  target_source_id,
  service_code: service.service_code ?? 'SVC-000',
  service_name: service.service_name ?? '테스트 서비스',
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  status,
  done_task_count: 0,
  total_task_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
});

describe('filterBySearch', () => {
  const rows = [row(1, 'DONE', '101'), row(2, 'DONE', '2015'), row(3, 'DONE', '305')];

  it('substring-matches target_source_id', () => {
    expect(filterBySearch(rows, '01').map((r) => r.target_source_id)).toEqual(['101', '2015']);
  });

  it('trims the query and passes through when empty', () => {
    expect(filterBySearch(rows, '   ')).toHaveLength(3);
    expect(filterBySearch(rows, ' 305 ').map((r) => r.target_source_id)).toEqual(['305']);
  });

  it('substring-matches service_code and service_name, case-insensitively', () => {
    const withServices = [
      row(1, 'DONE', '101', { service_code: 'N-IRP-001', service_name: 'PII Agent 설치 - 고객 DB' }),
      row(2, 'DONE', '201', { service_code: 'GCP-001', service_name: 'GCP PII Agent' }),
    ];
    expect(filterBySearch(withServices, 'n-irp').map((r) => r.target_source_id)).toEqual(['101']);
    expect(filterBySearch(withServices, '고객').map((r) => r.target_source_id)).toEqual(['101']);
    expect(filterBySearch(withServices, 'gcp').map((r) => r.target_source_id)).toEqual(['201']);
  });
});

describe('projectRows', () => {
  it('filters only — preserves the input (API response) order verbatim', () => {
    const rows = [
      row(1, 'DONE', '101'),
      row(2, 'FAILED', '102'),
      row(3, 'RUNNING', '201'),
    ];
    // q '10' keeps 101/102, in the SAME order they arrived (no priority re-sort)
    expect(projectRows(rows, '10').map((r) => r.pipeline_id)).toEqual([1, 2]);
  });
});

describe('paginate', () => {
  // Two full pages plus a partial one, expressed via the constant so the shape
  // under test (3 pages, last one short) survives a page-size change.
  const rows = Array.from({ length: DASH_PAGE_SIZE * 2 + 2 }, (_, i) => row(i, 'DONE', 't'));

  it('slices DASH_PAGE_SIZE per page and reports pages', () => {
    const p1 = paginate(rows, 1);
    expect(p1.slice).toHaveLength(DASH_PAGE_SIZE);
    expect(p1.pages).toBe(3);
    expect(p1.total).toBe(rows.length);
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
      '최근 24시간(생성시간 기준) 실패·성공 집계입니다. 기간 필터와 동기화되며, 동작 중은 현재 순간값입니다.',
    );
  });
});
