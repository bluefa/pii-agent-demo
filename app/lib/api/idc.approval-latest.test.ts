import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/api', () => ({
  getApprovalRequestLatest: vi.fn(),
  getApprovedIntegration: vi.fn(),
  getConfirmedIntegration: vi.fn(),
}));

import { getApprovalRequestLatest } from '@/app/lib/api';
import { getIdcApprovalRequestLatest } from '@/app/lib/api/idc';

const latest = vi.mocked(getApprovalRequestLatest);

describe('getIdcApprovalRequestLatest verdict', () => {
  it('carries the REJECTED verdict — reason, processed_at, processed_by', async () => {
    latest.mockResolvedValueOnce({
      request: { requested_at: '2026-09-01T00:00:00Z', requested_by: { user_id: 'dev-1' } },
      resources: [],
      result: {
        status: 'REJECTED',
        reason: 'Port 확인 필요',
        processed_at: '2026-09-02T00:00:00Z',
        processed_by: { user_id: 'admin-1' },
      },
    });
    const view = await getIdcApprovalRequestLatest(1);
    expect(view.rejected).toEqual({
      reason: 'Port 확인 필요',
      processedAt: '2026-09-02T00:00:00Z',
      processedBy: 'admin-1',
    });
    expect(view.unavailableReason).toBeNull();
  });

  it('leaves rejected null while PENDING', async () => {
    latest.mockResolvedValueOnce({ request: undefined, resources: [], result: { status: 'PENDING' } });
    expect((await getIdcApprovalRequestLatest(1)).rejected).toBeNull();
  });
});
