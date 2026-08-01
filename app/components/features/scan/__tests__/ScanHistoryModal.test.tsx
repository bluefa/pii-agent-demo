// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getScanHistory = vi.fn();
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: (...args: unknown[]) => getScanHistory(...args),
}));

import { ScanHistoryModal } from '@/app/components/features/scan/ScanHistoryModal';

describe('ScanHistoryModal', () => {
  it('renders one row per scan job: time · status · duration · outcome', async () => {
    getScanHistory.mockResolvedValueOnce({
      content: [
        {
          id: 11,
          scan_status: 'SUCCESS',
          created_at: '2026-07-31T05:00:00Z',
          duration_seconds: 32,
          resource_count_by_resource_type: { RDS: 9 },
        },
        {
          id: 10,
          scan_status: 'FAIL',
          created_at: '2026-07-30T00:10:00Z',
          duration_seconds: 4,
          scan_error: 'AUTH_PERMISSION_ERROR',
        },
      ],
    });
    render(<ScanHistoryModal targetSourceId={7} onClose={() => {}} />);

    expect(await screen.findByText('9개 발견')).toBeTruthy();
    expect(screen.getByText('성공')).toBeTruthy();
    expect(screen.getByText('실패')).toBeTruthy();
    expect(screen.getByText('스캔 권한 오류')).toBeTruthy();
    expect(screen.getByText('32초')).toBeTruthy();
    expect(getScanHistory).toHaveBeenCalledWith(7, 0, 10);
  });

  it('shows the empty message when no scans ran yet', async () => {
    getScanHistory.mockResolvedValueOnce({ content: [] });
    render(<ScanHistoryModal targetSourceId={7} onClose={() => {}} />);
    expect(await screen.findByText('아직 실행된 스캔이 없어요.')).toBeTruthy();
  });

  it('surfaces the load failure with a retry action', async () => {
    getScanHistory.mockRejectedValueOnce(new Error('boom'));
    render(<ScanHistoryModal targetSourceId={7} onClose={() => {}} />);
    expect(await screen.findByText('스캔 이력을 불러오지 못했어요.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    });
  });
});
