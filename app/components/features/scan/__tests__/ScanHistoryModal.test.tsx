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
    expect(getScanHistory).toHaveBeenCalledWith(7, 0, 10);
  });

  // 행을 누르면 같은 모달이 그 스캔의 상세로 바뀐다 — 타입별 개수는 이력 응답에
  // 이미 실려 오므로 추가 조회가 없다.
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
    // 모듈 스코프 vi.fn() 은 테스트 간에 리셋되지 않는다 — 절대 횟수가 아니라
    // 이 클릭이 요청을 더 만들었는지만 본다.
    const callsBeforeOpen = getScanHistory.mock.calls.length;

    fireEvent.click(screen.getByText('9개 발견'));

    expect(screen.getByText('스캔 결과 #7')).toBeTruthy();
    // 프로바이더 접두어는 표시에서만 떨어진다 (한 대상 안에서 상수라 정보가 없다).
    expect(screen.getByText('SQL_SERVER')).toBeTruthy();
    expect(screen.getByText('MARIADB')).toBeTruthy();
    expect(screen.getByText('실행 시각')).toBeTruthy();
    // 상세는 한 번 받아온 행으로 그린다 — 추가 요청 없음.
    expect(getScanHistory.mock.calls.length).toBe(callsBeforeOpen);

    fireEvent.click(screen.getByRole('button', { name: '목록으로' }));
    expect(screen.getByText('스캔 이력')).toBeTruthy();
    expect(screen.queryByText('SQL_SERVER')).toBeNull();
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
