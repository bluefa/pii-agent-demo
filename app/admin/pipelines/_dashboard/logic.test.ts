import { describe, expect, it } from 'vitest';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';
import {
  BUCKET_STATUSES,
  DASH_PAGE_SIZE,
  bucketCounts,
  buildStatsDesc,
  filterBySearch,
  filterByBucket,
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

describe('buckets', () => {
  const ALL_STATUSES: PipelineStatus[] = ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'];

  it('partitions every PipelineStatus into exactly one bucket', () => {
    // The tiles only add up to 전체 if this holds — a new status left out here
    // would vanish from the three named tiles while still counting in the total.
    for (const status of ALL_STATUSES) {
      const holders = Object.values(BUCKET_STATUSES).filter((set) => set.includes(status));
      expect(holders, `${status} must live in exactly one bucket`).toHaveLength(1);
    }
  });

  it('filters rows to the clicked bucket, and passes through for 전체', () => {
    const rows = ALL_STATUSES.map((s, i) => row(i, s, String(i)));
    expect(filterByBucket(rows, 'attention').map((r) => r.status)).toEqual(['FAILED']);
    expect(filterByBucket(rows, 'active').map((r) => r.status)).toEqual(['PENDING', 'RUNNING']);
    expect(filterByBucket(rows, 'closed').map((r) => r.status)).toEqual(['DONE', 'CANCELLED']);
    expect(filterByBucket(rows, 'all')).toHaveLength(5);
  });

  it('counts the three named buckets so they sum to 전체', () => {
    const counts = bucketCounts({
      period: '7d',
      since: '2026-08-03T00:00:00Z',
      pending_count: 1,
      running_count: 3,
      failed_count: 2,
      done_count: 126,
      cancelled_count: 2,
      total_count: 134,
    });
    expect(counts).toEqual({ attention: 2, active: 4, closed: 128, all: 134 });
    expect(counts.attention! + counts.active! + counts.closed!).toBe(counts.all);
  });

  it('reports null (not 0) before the counts arrive — 0 would read as good news', () => {
    expect(bucketCounts(null)).toEqual({
      attention: null,
      active: null,
      closed: null,
      all: null,
    });
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
