// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getHistory = vi.fn();
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionExecutionHistory: (...args: unknown[]) => getHistory(...args),
}));

import { TcRunHistoryModal } from '@/app/components/features/process-status/TcRunHistoryModal';

const row = (version: number) => ({
  version,
  status: 'SUCCESS' as const,
  requestedAt: '2026-06-01T09:00:00Z',
  completedAt: '2026-06-01T09:04:00Z',
});

describe('TcRunHistoryModal', () => {
  beforeEach(() => {
    getHistory.mockReset();
  });

  // The pager lives inside the rows branch, so a past-the-end page (rows gone,
  // positive total) would hide the only control that leads back out — the page
  // number outlives the list (PR #708). The response handler must clamp.
  it('clamps a past-the-end page back to the last real page', async () => {
    getHistory.mockImplementation(async (_id: number, page: number) => {
      if (page === 0) {
        return {
          totalElements: 6,
          totalPages: 2,
          size: 5,
          number: 0,
          content: [row(6), row(5), row(4), row(3), row(2)],
        };
      }
      // The trail shrank while the modal was open: page 1 no longer exists.
      return { totalElements: 5, totalPages: 1, size: 5, number: 1, content: [] };
    });
    render(<TcRunHistoryModal open targetSourceId={2104} onClose={() => {}} />);

    expect(await screen.findByText('#6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));

    // The empty answer clamps back to page 0 and refetches it — the rows return
    // and no fourth fetch fires (no clamp loop).
    await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(3));
    expect(getHistory.mock.calls[2][1]).toBe(0);
    expect(await screen.findByText('#6')).toBeTruthy();
    expect(screen.queryByText('이 페이지에는 기록이 없어요.')).toBeNull();
  });
});
