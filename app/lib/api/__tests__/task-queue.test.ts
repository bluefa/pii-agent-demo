import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDashboardSummary, getProcessStatuses } from '@/app/lib/api/task-queue';

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** First fetch call's URL as a string. */
function calledUrl(): string {
  return String(fetchMock.mock.calls[0][0]);
}

describe('app/lib/api/task-queue CSR helper', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getDashboardSummary hits the KPI route and returns the camel body verbatim', async () => {
    const summary = {
      pendingApprovalCount: 4,
      rejectedApprovalCount: 2,
      testConnectionCompletedCount: 3,
      testConnectionRejectionCount: 1,
      evaluatedAt: '2026-07-20T13:00:00Z',
    };
    fetchMock.mockResolvedValue(jsonResponse(summary));
    await expect(getDashboardSummary()).resolves.toEqual(summary);
    expect(calledUrl()).toContain('/admin/queue/dashboard-summary');
  });

  it('getProcessStatuses forwards processStatus/page/size (0-indexed page)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    await getProcessStatuses({ processStatus: 'PENDING', page: 0, size: 20 });
    const url = calledUrl();
    expect(url).toContain('/admin/queue/process-statuses?');
    expect(url).toContain('processStatus=PENDING');
    expect(url).toContain('page=0');
    expect(url).toContain('size=20');
  });

  it('getProcessStatuses omits absent params (no trailing query string)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    await getProcessStatuses();
    const url = calledUrl();
    expect(url).toContain('/admin/queue/process-statuses');
    expect(url).not.toContain('?');
  });

  it('getProcessStatuses forwards a targetSourceId filter when given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    await getProcessStatuses({ targetSourceId: 1027 });
    expect(calledUrl()).toContain('targetSourceId=1027');
  });

  it('forwards the AbortSignal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    const controller = new AbortController();
    await getProcessStatuses({}, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });
});
