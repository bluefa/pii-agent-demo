import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    confirm: {
      getApprovalHistory: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/integration/v1/target-sources/[targetSourceId]/approval-requests/latest/route';
import { client } from '@/lib/api-client';

const mockedGetApprovalHistory = vi.mocked(client.confirm.getApprovalHistory);

describe('GET /api/integration/v1/target-sources/[targetSourceId]/approval-requests/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approval history 첫 항목을 latest 응답으로 반환한다', async () => {
    mockedGetApprovalHistory.mockResolvedValue(NextResponse.json({
      content: [
        {
          request: {
            id: 'req-1',
            requested_at: '2026-03-29T10:00:00Z',
            requested_by: '홍길동',
          },
          result: {
            id: 'result-1',
            request_id: 'req-1',
            result: 'APPROVED',
            processed_at: '2026-03-29T10:10:00Z',
          },
        },
      ],
      page: { totalElements: 1, totalPages: 1, number: 0, size: 1 },
    }));

    const response = await GET(
      new Request('http://localhost/api/integration/v1/target-sources/1003/approval-requests/latest'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      request: {
        id: 'req-1',
        requested_at: '2026-03-29T10:00:00Z',
        requested_by: '홍길동',
      },
      result: {
        id: 'result-1',
        request_id: 'req-1',
        result: 'APPROVED',
        processed_at: '2026-03-29T10:10:00Z',
      },
    });
    expect(mockedGetApprovalHistory).toHaveBeenCalledWith('azure-proj-1', 0, 1);
  });

  it('approval history가 비어 있으면 404 problem 응답을 반환한다', async () => {
    mockedGetApprovalHistory.mockResolvedValue(NextResponse.json({
      content: [],
      page: { totalElements: 0, totalPages: 0, number: 0, size: 1 },
    }));

    const response = await GET(
      new Request('http://localhost/api/integration/v1/target-sources/1003/approval-requests/latest'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
