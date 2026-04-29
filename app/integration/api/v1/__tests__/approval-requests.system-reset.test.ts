import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      systemResetApprovalRequest: vi.fn(),
    },
  },
}));

import { POST } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/system-reset/route';
import { bff } from '@/lib/bff/client';

const mockedSystemReset = vi.mocked(bff.confirm.systemResetApprovalRequest);

describe('POST /integration/api/v1/target-sources/[targetSourceId]/approval-requests/system-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BFF 응답을 ApprovalActionResponseDto 형식으로 정규화하여 반환한다', async () => {
    mockedSystemReset.mockResolvedValue({
      success: true,
      result: 'CANCELLED',
      processed_at: '2026-04-29T10:00:00Z',
      reason: 'system-reset',
    });

    const response = await POST(
      new Request('http://localhost/integration/api/v1/target-sources/2001/approval-requests/system-reset', {
        method: 'POST',
      }),
      { params: Promise.resolve({ targetSourceId: '2001' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'CANCELLED',
      processed_at: '2026-04-29T10:00:00Z',
      reason: 'system-reset',
    });
    expect(mockedSystemReset).toHaveBeenCalledWith(2001);
  });

  it('BFF 가 409 를 반환하면 ProblemDetails 로 변환한다', async () => {
    mockedSystemReset.mockRejectedValue(
      new BffError(409, 'APPROVAL_REQUEST_NOT_RESETTABLE', 'REJECTED 또는 UNAVAILABLE 상태에서만 system-reset 호출 가능합니다.'),
    );

    const response = await POST(
      new Request('http://localhost/integration/api/v1/target-sources/2001/approval-requests/system-reset', {
        method: 'POST',
      }),
      { params: Promise.resolve({ targetSourceId: '2001' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: 409,
    });
  });

  it('BFF 가 404 를 반환하면 ProblemDetails 로 변환한다', async () => {
    mockedSystemReset.mockRejectedValue(
      new BffError(404, 'NOT_FOUND', '리셋할 approval-request 없음'),
    );

    const response = await POST(
      new Request('http://localhost/integration/api/v1/target-sources/9999/approval-requests/system-reset', {
        method: 'POST',
      }),
      { params: Promise.resolve({ targetSourceId: '9999' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      status: 404,
    });
  });

  it('잘못된 targetSourceId 는 400 ProblemDetails 를 반환한다', async () => {
    const response = await POST(
      new Request('http://localhost/integration/api/v1/target-sources/abc/approval-requests/system-reset', {
        method: 'POST',
      }),
      { params: Promise.resolve({ targetSourceId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    expect(mockedSystemReset).not.toHaveBeenCalled();
  });
});
