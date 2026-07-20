import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    taskQueue: {
      getDashboardSummary: vi.fn(),
      getProcessStatuses: vi.fn(),
      getTargetSourcesPage: vi.fn(),
      putNlbIndex: vi.fn(),
      getTestConnectionPage: vi.fn(),
      getTestConnectionStatus: vi.fn(),
      rejectTestConnection: vi.fn(),
    },
  },
}));

import { GET as getDashboard } from '@/app/api/v1/admin/queue/dashboard-summary/route';
import { GET as getProcessStatuses } from '@/app/api/v1/admin/queue/process-statuses/route';
import { GET as getTargetSources } from '@/app/api/v1/admin/queue/target-sources/route';
import { GET as getTestConnections } from '@/app/api/v1/admin/queue/test-connections/route';
import { PUT as putNlbIndex } from '@/app/api/v1/target-sources/[targetSourceId]/approval-requests/nlb-indices/route';
import { GET as getTcStatus } from '@/app/api/v1/target-sources/[targetSourceId]/test-connection/status/route';
import { POST as postTcReject } from '@/app/api/v1/target-sources/[targetSourceId]/test-connection/reject/route';
import { bff } from '@/lib/bff/client';

const tq = vi.mocked(bff.taskQueue);
const noParams = { params: Promise.resolve({} as Record<string, string>) };
const tsParams = (id: string) => ({ params: Promise.resolve({ targetSourceId: id }) });

describe('Admin Task Queue routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dashboard-summary reshapes the snake wire to camel KPI counts', async () => {
    tq.getDashboardSummary.mockResolvedValue({
      pending_approval_count: 4,
      rejected_approval_count: 2,
      test_connection_completed_count: 3,
      test_connection_rejection_count: 1,
      evaluated_at: '2026-07-20T00:00:00Z',
    });

    const res = await getDashboard(new Request('http://localhost/admin/queue/dashboard-summary'), noParams);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      pendingApprovalCount: 4,
      rejectedApprovalCount: 2,
      testConnectionCompletedCount: 3,
      testConnectionRejectionCount: 1,
      evaluatedAt: '2026-07-20T00:00:00Z',
    });
  });

  it('process-statuses passes filters through and reshapes rows (server delay_seconds)', async () => {
    tq.getProcessStatuses.mockResolvedValue({
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
      first: true,
      last: true,
      numberOfElements: 1,
      empty: false,
      content: [
        {
          target_source_id: 1027,
          process_status: 'PENDING',
          status_changed_at: '2026-07-19T16:08:00Z',
          delay_seconds: 99120,
          target_source: {
            cloudProvider: 'IDC',
            service_info: { serviceName: '주문서비스', code: 'ORD', abbr: 'ORD' },
          },
        },
      ],
    });

    const res = await getProcessStatuses(
      new Request('http://localhost/admin/queue/process-statuses?processStatus=PENDING&page=0&size=20'),
      noParams,
    );
    expect(res.status).toBe(200);
    expect(tq.getProcessStatuses).toHaveBeenCalledWith({
      processStatus: 'PENDING',
      targetSourceId: undefined,
      page: 0,
      size: 20,
    });
    const body = await res.json();
    expect(body.content[0]).toMatchObject({
      targetSourceId: 1027,
      processStatus: 'PENDING',
      delaySeconds: 99120,
      serviceName: '주문서비스',
      serviceCode: 'ORD',
      cloudProvider: 'IDC',
    });
  });

  it('target-sources normalizes the TargetSourceInfo camel island + snake latest_approval_request', async () => {
    tq.getTargetSourcesPage.mockResolvedValue({
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
      first: true,
      last: true,
      numberOfElements: 1,
      empty: false,
      content: [
        {
          targetSourceId: 1907,
          serviceName: '광고서비스',
          serviceCode: 'ADS',
          cloudProvider: 'AWS',
          confirmStatus: 'REJECTED',
          latest_approval_request: {
            request_id: 1907,
            status: 'REJECTED',
            reason: 'stg 리소스 포함',
            processed_at: '2026-07-18T11:02:00Z',
          },
        },
      ],
    });

    const res = await getTargetSources(
      new Request('http://localhost/admin/queue/target-sources?confirmStatus=REJECTED'),
      noParams,
    );
    expect(res.status).toBe(200);
    expect(tq.getTargetSourcesPage).toHaveBeenCalledWith({
      confirmStatus: 'REJECTED',
      targetSourceId: undefined,
      page: 0,
      size: 10,
    });
    const body = await res.json();
    expect(body.content[0]).toMatchObject({
      targetSourceId: 1907,
      serviceName: '광고서비스',
      confirmStatus: 'REJECTED',
      latestApprovalRequest: { reason: 'stg 리소스 포함', processedAt: '2026-07-18T11:02:00Z' },
    });
  });

  it('test-connections rejects an out-of-contract status with 400', async () => {
    const res = await getTestConnections(
      new Request('http://localhost/admin/queue/test-connections?status=BOGUS'),
      noParams,
    );
    expect(res.status).toBe(400);
    expect(tq.getTestConnectionPage).not.toHaveBeenCalled();
  });

  it('test-connections reshapes the completed queue rows', async () => {
    tq.getTestConnectionPage.mockResolvedValue({
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
      first: true,
      last: true,
      numberOfElements: 1,
      empty: false,
      content: [
        {
          target_source_id: 1799,
          status: 'TEST_CONNECTION_COMPLETED',
          service_name: '배송서비스',
          service_code: 'DLV',
          cloud_provider: 'AZURE',
          completed_at: '2026-07-20T17:19:00Z',
          reject_reason: null,
          rejected_at: null,
        },
      ],
    });

    const res = await getTestConnections(
      new Request('http://localhost/admin/queue/test-connections?status=TEST_CONNECTION_COMPLETED'),
      noParams,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content[0]).toMatchObject({
      targetSourceId: 1799,
      status: 'TEST_CONNECTION_COMPLETED',
      serviceName: '배송서비스',
      completedAt: '2026-07-20T17:19:00Z',
    });
  });

  it('nlb-indices PUT validates the single assignment body and forwards it', async () => {
    tq.putNlbIndex.mockResolvedValue({ resource_id: 'idc-r-8f21', nlb_index: 2 });

    const res = await putNlbIndex(
      new Request('http://localhost/target-sources/1027/approval-requests/nlb-indices', {
        method: 'PUT',
        body: JSON.stringify({ resource_id: 'idc-r-8f21', nlb_index: 2 }),
      }),
      tsParams('1027'),
    );
    expect(res.status).toBe(200);
    expect(tq.putNlbIndex).toHaveBeenCalledWith(1027, { resource_id: 'idc-r-8f21', nlb_index: 2 });
  });

  it('test-connection/status (single) reshapes the rejected status', async () => {
    tq.getTestConnectionStatus.mockResolvedValue({
      target_source_id: 1583,
      status: 'TEST_CONNECTION_REJECTED',
      service_name: '재고서비스',
      service_code: 'IVT',
      cloud_provider: 'IDC',
      reject_reason: 'timeout',
      rejected_at: '2026-07-19T14:52:00Z',
      completed_at: null,
    });

    const res = await getTcStatus(
      new Request('http://localhost/target-sources/1583/test-connection/status'),
      tsParams('1583'),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      targetSourceId: 1583,
      status: 'TEST_CONNECTION_REJECTED',
      rejectReason: 'timeout',
      rejectedAt: '2026-07-19T14:52:00Z',
    });
  });

  it('test-connection/reject POST validates the reason body and forwards it', async () => {
    tq.rejectTestConnection.mockResolvedValue({ target_source_id: 1583, status: 'TEST_CONNECTION_REJECTED' });

    const res = await postTcReject(
      new Request('http://localhost/target-sources/1583/test-connection/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: '재실행 요청' }),
      }),
      tsParams('1583'),
    );
    expect(res.status).toBe(200);
    expect(tq.rejectTestConnection).toHaveBeenCalledWith(1583, { reason: '재실행 요청' });
  });

  it('rejects a non-numeric targetSourceId with 400', async () => {
    const res = await getTcStatus(
      new Request('http://localhost/target-sources/abc/test-connection/status'),
      tsParams('abc'),
    );
    expect(res.status).toBe(400);
    expect(tq.getTestConnectionStatus).not.toHaveBeenCalled();
  });
});
