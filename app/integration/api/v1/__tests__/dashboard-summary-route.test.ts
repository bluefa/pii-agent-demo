import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    dashboard: {
      summary: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/admin/dashboard/summary/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedSummary = vi.mocked(bff.dashboard.summary);

describe('GET /integration/api/v1/admin/dashboard/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('대시보드 summary 데이터를 그대로 반환한다', async () => {
    const summary = {
      totalProjects: 10,
      activeProjects: 5,
      pendingApprovals: 2,
    };
    mockedSummary.mockResolvedValue(summary as never);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/admin/dashboard/summary'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
  });

  it('BffError가 throw되면 ProblemDetails로 변환한다', async () => {
    mockedSummary.mockRejectedValueOnce(
      new BffError(500, 'INTERNAL_ERROR', '서버 오류'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/admin/dashboard/summary'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});
