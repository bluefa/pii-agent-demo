import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      getApprovalRequestLatest: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/latest/route';
import { bff } from '@/lib/bff/client';

const mockedGetApprovalRequestLatest = vi.mocked(bff.confirm.getApprovalRequestLatest);

describe('GET /integration/api/v1/target-sources/[targetSourceId]/approval-requests/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BFF 형식의 latest 응답을 그대로 반환한다', async () => {
    const bffResponse = {
      request: {
        id: 100,
        target_source_id: 1003,
        status: 'APPROVED',
        requested_by: { user_id: '홍길동' },
        requested_at: '2026-03-29T10:00:00Z',
        resource_total_count: 10,
        resource_selected_count: 3,
      },
      result: {
        request_id: 100,
        status: 'APPROVED',
        processed_by: { user_id: 'admin' },
        processed_at: '2026-03-29T10:10:00Z',
        reason: null,
      },
    };
    mockedGetApprovalRequestLatest.mockResolvedValue(bffResponse);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1003/approval-requests/latest'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(bffResponse);
    expect(mockedGetApprovalRequestLatest).toHaveBeenCalledWith(1003);
  });

  it('BFF가 404를 반환하면 ProblemDetails로 변환한다', async () => {
    mockedGetApprovalRequestLatest.mockRejectedValue(
      new BffError(404, 'NOT_FOUND', '승인 요청 이력이 없습니다.'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1003/approval-requests/latest'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });
});
