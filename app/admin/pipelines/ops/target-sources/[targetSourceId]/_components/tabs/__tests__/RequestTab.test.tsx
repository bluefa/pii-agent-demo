// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

const getApprovalRequestLatest = vi.fn();
const getConfirmedIntegration = vi.fn();
const getApprovalHistory = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', () => ({
  getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatest(...args),
}));
vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
  getApprovalHistory: (...args: unknown[]) => getApprovalHistory(...args),
}));

import { RequestTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';

const row = (index: number, selected = true): RequestResourceRow => ({
  resourceId: `res-${index}`,
  resourceName: `resource-${index}`,
  selected,
  exclusionReason: selected ? null : '스테이징 전용',
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  idcKind: null,
  connectTargets: [],
  port: null,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
});

const CSP: RawTargetSourceDetail = { cloud_provider: 'AWS' };

const mountWith = (count: number, excludeEvery = 0) => {
  const resources = Array.from({ length: count }, (_, i) =>
    row(i, excludeEvery === 0 || i % excludeEvery !== 0),
  );
  getApprovalRequestLatest.mockResolvedValue({
    request: {
      requestId: 1,
      status: 'APPROVED',
      requestedBy: 'ops',
      requestedAt: '2026-07-31T05:00:00Z',
      resourceTotalCount: count,
      resourceSelectedCount: resources.filter((r) => r.selected).length,
    },
    resources,
  });
  return render(<RequestTab targetSourceId={1642} detail={CSP} />);
};

describe('RequestTab 요청 리소스', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [] });
    getApprovalHistory.mockResolvedValue({ content: [] });
  });

  /**
   * LIN-82 — …/approval-requests/latest returns every resource inline, so a
   * target with hundreds of them rendered one unbounded table.
   */
  it('renders only one page of rows and pages through the rest', async () => {
    mountWith(23);

    expect(await screen.findByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-9')).toBeTruthy();
    expect(screen.queryByText('resource-10')).toBeNull();

    // 23 rows / 10 = 3 pages.
    expect(screen.getByRole('button', { name: '3 페이지' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '4 페이지' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(await screen.findByText('resource-10')).toBeTruthy();
    expect(screen.queryByText('resource-9')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '3 페이지' }));
    expect(await screen.findByText('resource-20')).toBeTruthy();
    // Last page is the 3-row remainder.
    expect(screen.getByText('resource-22')).toBeTruthy();
    expect(screen.queryByText('resource-19')).toBeNull();
  });

  /** The tiles carry the whole request, never the visible page. */
  it('surfaces the request size as filter tiles', async () => {
    mountWith(23, 5);

    expect(await screen.findByRole('button', { name: /전체 요청\s*23/ })).toBeTruthy();
    // Every 5th row is excluded → 5 of 23.
    expect(screen.getByRole('button', { name: /연동 요청 제외대상\s*5/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연동 요청 대상\s*18/ })).toBeTruthy();
  });

  /**
   * `resource_id` is an internal NLB-PUT key for IDC (design-spec §8) — the shared
   * table has a Resource ID column, so the adapter must not hand it one.
   */
  it('never surfaces an IDC resource_id', async () => {
    getApprovalRequestLatest.mockResolvedValue({
      request: { requestId: 1, status: 'PENDING', requestedBy: 'ops', requestedAt: '2026-07-31T05:00:00Z' },
      resources: [
        {
          ...row(0),
          resourceId: 'idc-r-8f21',
          resourceName: null,
          connectTargets: ['10.20.1.11'],
          idcKind: 'IP',
        },
      ],
    });
    render(<RequestTab targetSourceId={1031} detail={{ cloud_provider: 'IDC' }} />);

    // The host stands in for the name; the internal id appears nowhere.
    expect(await screen.findByText('10.20.1.11')).toBeTruthy();
    expect(screen.queryByText('idc-r-8f21')).toBeNull();
  });

  /**
   * The shared table has no Port column, so an IDC row's port would vanish unless it
   * rides with the host — the endpoint is what the operator has to verify.
   */
  it('keeps an IDC row\'s port on its endpoint', async () => {
    getApprovalRequestLatest.mockResolvedValue({
      request: { requestId: 1, status: 'PENDING', requestedBy: 'ops', requestedAt: '2026-07-31T05:00:00Z' },
      resources: [
        { ...row(0), resourceId: 'idc-r-1', resourceName: null, connectTargets: ['10.20.1.11'], port: 1521 },
      ],
    });
    render(<RequestTab targetSourceId={1031} detail={{ cloud_provider: 'IDC' }} />);

    expect(await screen.findByText('10.20.1.11:1521')).toBeTruthy();
  });

  it('filters the table when a tile is picked', async () => {
    mountWith(23, 5);
    await screen.findByText('resource-1');

    fireEvent.click(screen.getByRole('button', { name: /연동 요청 제외대상/ }));
    expect(screen.getByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-5')).toBeTruthy();
    expect(screen.queryByText('resource-1')).toBeNull();
  });
});
