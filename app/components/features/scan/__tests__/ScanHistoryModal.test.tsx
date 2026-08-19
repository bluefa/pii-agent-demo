// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getScanHistory = vi.fn();
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: (...args: unknown[]) => getScanHistory(...args),
}));

import { ScanHistoryModal } from '@/app/components/features/scan/ScanHistoryModal';

const renderModal = () =>
  render(<ScanHistoryModal targetSourceId={7} provider="Azure" onClose={() => {}} />);

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
    renderModal();

    expect(await screen.findByText('9개 발견')).toBeTruthy();
    expect(screen.getByText('성공')).toBeTruthy();
    expect(screen.getByText('실패')).toBeTruthy();
    expect(screen.getByText('스캔 권한 오류')).toBeTruthy();
    expect(screen.getByText('32초')).toBeTruthy();
    expect(getScanHistory).toHaveBeenCalledWith(7, 0, 5);
  });

  // 건수 맵이 없는 SUCCESS 는 완료지만(오너 확정) 잰 숫자가 없다 — "0개 발견"은
  // 하지 않은 측정을 주장한다. admin 이력 표가 같은 자리에 쓰는 '—' 와 맞춘다.
  it('건수 맵이 없는 성공은 0을 주장하지 않는다', async () => {
    getScanHistory.mockResolvedValueOnce({
      content: [
        {
          id: 12,
          scan_status: 'SUCCESS',
          created_at: '2026-08-19T05:00:00Z',
          duration_seconds: 32,
          resource_count_by_resource_type: null,
        },
      ],
    });
    renderModal();

    expect(await screen.findByText('성공')).toBeTruthy();
    expect(screen.queryByText('0개 발견')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();

    // 행을 열어 본 상세도 같은 말을 해야 한다 — "발견된 리소스가 없어요"는 하지
    // 않은 측정을 "0건을 쟀다"로 바꿔 말하는 것이다.
    fireEvent.click(screen.getByRole('button', { name: /스캔 상세 보기/ }));
    expect(await screen.findByText('목록으로')).toBeTruthy();
    expect(screen.queryByText('발견된 리소스가 없어요.')).toBeNull();
    expect(screen.queryByText(/개를 발견했어요/)).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  // Clicking a row swaps the same modal to that scan's detail; the per-type counts
  // ride along on the history response, so no extra request is made.
  it('opens the per-scan detail in place and returns to the list', async () => {
    getScanHistory.mockResolvedValueOnce({
      content: [
        {
          id: 11,
          scan_status: 'SUCCESS',
          scan_version: 7,
          created_at: '2026-07-31T05:00:00Z',
          updated_at: '2026-07-31T05:00:32Z',
          duration_seconds: 32,
          resource_count_by_resource_type: { AZURE_SQL_SERVER: 8, AZURE_MARIADB: 1 },
        },
      ],
      totalElements: 1,
    });
    renderModal();
    await screen.findByText('9개 발견');
    // The module-scope vi.fn() is not reset between tests, so assert that this click
    // added no request rather than an absolute call count.
    const callsBeforeOpen = getScanHistory.mock.calls.length;

    // The row is exposed as a control, not just a table row, so assistive tech
    // announces it as actionable.
    const row = screen.getByRole('button', { name: /스캔 상세 보기/ });
    fireEvent.click(row);

    expect(screen.getByText('스캔 결과 #7')).toBeTruthy();
    // The provider prefix is dropped for display only (it is constant per target).
    expect(screen.getByText('SQL_SERVER')).toBeTruthy();
    expect(screen.getByText('MARIADB')).toBeTruthy();
    expect(screen.getByText('실행 시각')).toBeTruthy();
    // The detail renders from the row already fetched — no extra request.
    expect(getScanHistory.mock.calls.length).toBe(callsBeforeOpen);

    fireEvent.click(screen.getByRole('button', { name: '목록으로' }));
    expect(screen.getByText('스캔 이력')).toBeTruthy();
    expect(screen.queryByText('SQL_SERVER')).toBeNull();
    // Coming back restores focus to the row that opened the detail, so keyboard
    // users do not land at the top of the list again.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /스캔 상세 보기/ }));
  });

  it('opens the detail from the keyboard (Enter)', async () => {
    getScanHistory.mockResolvedValueOnce({
      content: [
        {
          id: 11,
          scan_status: 'SUCCESS',
          scan_version: 7,
          created_at: '2026-07-31T05:00:00Z',
          resource_count_by_resource_type: { AZURE_SQL_SERVER: 8 },
        },
      ],
      totalElements: 1,
    });
    renderModal();

    fireEvent.keyDown(await screen.findByRole('button', { name: /스캔 상세 보기/ }), { key: 'Enter' });
    expect(screen.getByText('스캔 결과 #7')).toBeTruthy();
  });

  it('shows the empty message when no scans ran yet', async () => {
    getScanHistory.mockResolvedValueOnce({ content: [] });
    renderModal();
    expect(await screen.findByText('아직 실행된 스캔이 없어요.')).toBeTruthy();
  });

  it('surfaces the load failure with a retry action', async () => {
    getScanHistory.mockRejectedValueOnce(new Error('boom'));
    renderModal();
    expect(await screen.findByText('스캔 이력을 불러오지 못했어요.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    });
  });
});
