// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cancelApprovalRequestMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  cancelApprovalRequest: (...args: unknown[]) => cancelApprovalRequestMock(...args),
}));

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  toastGlobal: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

import { WaitingApprovalCancelButton } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';

describe('WaitingApprovalCancelButton', () => {
  beforeEach(() => {
    cancelApprovalRequestMock.mockReset();
  });

  it('opens the modal when the trigger button is clicked', () => {
    render(
      <WaitingApprovalCancelButton targetSourceId={1003} onSuccess={async () => {}} />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /연동 대상 승인 요청 취소/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText('연동 대상 승인 요청을 취소할까요?'),
    ).toBeTruthy();
  });

  it('calls cancelApprovalRequest and onSuccess on confirm, then closes the modal', async () => {
    cancelApprovalRequestMock.mockResolvedValueOnce({ success: true });
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    render(
      <WaitingApprovalCancelButton targetSourceId={1003} onSuccess={onSuccess} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /연동 대상 승인 요청 취소/ }));
    fireEvent.click(screen.getByRole('button', { name: '요청 취소' }));

    await waitFor(() => {
      expect(cancelApprovalRequestMock).toHaveBeenCalledWith(1003);
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('keeps the modal open and does not call onSuccess when the request fails', async () => {
    cancelApprovalRequestMock.mockRejectedValueOnce(new Error('fail'));
    const onSuccess = vi.fn();

    render(
      <WaitingApprovalCancelButton targetSourceId={1003} onSuccess={onSuccess} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /연동 대상 승인 요청 취소/ }));
    fireEvent.click(screen.getByRole('button', { name: '요청 취소' }));

    await waitFor(() => {
      expect(cancelApprovalRequestMock).toHaveBeenCalled();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
