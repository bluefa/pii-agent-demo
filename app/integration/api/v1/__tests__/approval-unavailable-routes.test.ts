import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      markApprovalRequestUnavailable: vi.fn(),
      confirmApprovalUnavailable: vi.fn(),
      cancelApprovalRequest: vi.fn(),
    },
  },
}));

import { POST as markUnavailable } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approval-unavailable/route';
import { POST as confirmUnavailable } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approval-unavailable/confirm/route';
import { POST as cancel } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/cancel/route';
import { bff } from '@/lib/bff/client';

const mockedMark = vi.mocked(bff.confirm.markApprovalRequestUnavailable);
const mockedConfirm = vi.mocked(bff.confirm.confirmApprovalUnavailable);
const mockedCancel = vi.mocked(bff.confirm.cancelApprovalRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST …/approval-unavailable (#7)', () => {
  it('normalizes the snake ApprovalUnavailableResponseDto to camel', async () => {
    mockedMark.mockResolvedValue({
      request_id: 1024,
      status: 'UNAVAILABLE',
      processed_by: { user_id: 'admin@corp' },
      processed_at: '2026-06-23T07:00:00Z',
      reason: '방화벽 정책상 연동 불가',
    });

    const response = await markUnavailable(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ reason: '방화벽 정책상 연동 불가' }),
      }),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requestId: 1024,
      status: 'UNAVAILABLE',
      processedBy: { userId: 'admin@corp' },
      processedAt: '2026-06-23T07:00:00Z',
      reason: '방화벽 정책상 연동 불가',
    });
    expect(mockedMark).toHaveBeenCalledWith(42, { reason: '방화벽 정책상 연동 불가' });
  });

  it('maps BffError to ProblemDetails', async () => {
    mockedMark.mockRejectedValue(new BffError(409, 'CONFLICT', '전이 불가'));
    const response = await markUnavailable(
      new Request('http://localhost/x', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });
});

describe('POST …/approval-unavailable/confirm (#8)', () => {
  it('normalizes the snake ApprovalUnavailableConfirmResponseDto to camel', async () => {
    mockedConfirm.mockResolvedValue({
      target_source_id: 42,
      confirm_status: 'IDLE',
      processed_at: '2026-06-23T07:10:00Z',
      confirmed_by: 'alice@corp',
    });

    const response = await confirmUnavailable(
      new Request('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      targetSourceId: 42,
      confirmStatus: 'IDLE',
      processedAt: '2026-06-23T07:10:00Z',
      confirmedBy: 'alice@corp',
    });
    expect(mockedConfirm).toHaveBeenCalledWith(42);
  });
});

describe('POST …/approval-requests/cancel', () => {
  it('returns the normalized action response directly (no history re-fetch)', async () => {
    mockedCancel.mockResolvedValue({
      request_id: 1024,
      status: 'CANCELLED',
      processed_by: { user_id: 'alice@corp' },
      processed_at: '2026-06-23T05:02:00Z',
    });

    const response = await cancel(
      new Request('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requestId: 1024,
      status: 'CANCELLED',
      processedBy: { userId: 'alice@corp' },
      processedAt: '2026-06-23T05:02:00Z',
      reason: '',
    });
    // Only the cancel call — the prior getApprovalHistory workaround is gone.
    expect(mockedCancel).toHaveBeenCalledWith(42);
  });
});
