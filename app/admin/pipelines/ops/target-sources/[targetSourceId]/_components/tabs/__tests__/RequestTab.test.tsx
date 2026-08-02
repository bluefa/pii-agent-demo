// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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

const row = (index: number): RequestResourceRow => ({
  resourceId: `res-${index}`,
  resourceName: `resource-${index}`,
  selected: true,
  exclusionReason: null,
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

const mountWith = (count: number) => {
  getApprovalRequestLatest.mockResolvedValue({
    request: {
      requestId: 1,
      status: 'APPROVED',
      requestedBy: 'ops',
      requestedAt: '2026-07-31T05:00:00Z',
      resourceTotalCount: count,
      resourceSelectedCount: count,
    },
    resources: Array.from({ length: count }, (_, i) => row(i)),
  });
  return render(<RequestTab targetSourceId={1642} detail={CSP} />);
};

describe('RequestTab 요청 리소스 paging', () => {
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
    expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(await screen.findByText('resource-10')).toBeTruthy();
    expect(screen.queryByText('resource-9')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(await screen.findByText('resource-20')).toBeTruthy();
    // Last page is the 3-row remainder.
    expect(screen.getByText('resource-22')).toBeTruthy();
    expect(screen.queryByText('resource-19')).toBeNull();
  });

  it('hides the pager when everything fits on one page', async () => {
    mountWith(4);

    expect(await screen.findByText('resource-3')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: '페이지' })).toBeNull();
  });

  it('still counts against the full result, not the visible page', async () => {
    mountWith(23);
    await waitFor(() => expect(screen.getByText('연동 대상 23개 · 제외 0개')).toBeTruthy());
  });
});
