// @vitest-environment jsdom
/**
 * The move deadline in `ServiceListPanel`.
 *
 * The guarantee under test is the one a spinner cannot give: once the dialog has said
 * the move failed, an answer that arrives afterwards must NOT navigate. React's own
 * transitions are not cancellable, which is why the deadline is spent on an abortable
 * request and the router is only handed control while `timedOut` is still false —
 * delete that check and this test is the thing that fails.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceListPanel } from '@/app/target-sources/[targetSourceId]/_components/ServiceListPanel';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const getServicesPage = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getServicesPage: (...args: unknown[]) => getServicesPage(...args),
}));

vi.mock('@/app/components/features/admin/ServiceSidebar', () => ({
  SERVICE_RAIL_PAGE_SIZE: 8,
  ServiceSidebar: ({ onSelectService }: { onSelectService: (code: string) => void }) => (
    <button type="button" onClick={() => onSelectService('idc')}>
      select-idc
    </button>
  ),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal',
  () => ({
    ServiceMoveConfirmModal: ({
      isOpen,
      onConfirm,
      isPending,
      errorReason,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
      isPending?: boolean;
      errorReason?: string | null;
    }) =>
      isOpen ? (
        <div>
          <button type="button" onClick={onConfirm}>
            이동하기
          </button>
          {isPending ? <span data-testid="pending" /> : null}
          {errorReason ? <span data-testid="reason">{errorReason}</span> : null}
        </div>
      ) : null,
  }),
);

const emptyPage = { content: [], totalElements: 0, totalPages: 1, number: 0, size: 8 };

/** Opens the dialog with the rail's initial fetch already settled. */
const openMoveDialog = async (): Promise<void> => {
  getServicesPage.mockResolvedValueOnce(emptyPage);
  render(<ServiceListPanel currentService={{ code: 'aws' }} />);
  // next/dynamic resolves the dialog module a microtask after mount.
  fireEvent.click(await screen.findByText('select-idc'));
  await screen.findByText('이동하기');
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
  getServicesPage.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ServiceListPanel — 이동 deadline', () => {
  it('drops an answer that arrives after the deadline instead of navigating', async () => {
    await openMoveDialog();

    // The move's own request never settles on its own — the deadline is what ends it.
    let settle: (value: typeof emptyPage) => void = () => undefined;
    getServicesPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    fireEvent.click(screen.getByText('이동하기'));
    expect(screen.getByTestId('pending')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('reason').textContent).toContain('5초');
    expect(push).not.toHaveBeenCalled();

    // 5.1s: the answer finally lands. The frame already said the move failed, so it
    // must be discarded — settling is not a navigation.
    await act(async () => {
      settle(emptyPage);
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pending')).toBeNull();
  });

  it('navigates when the answer beats the deadline', async () => {
    await openMoveDialog();

    getServicesPage.mockResolvedValueOnce(emptyPage);
    await act(async () => {
      fireEvent.click(screen.getByText('이동하기'));
    });

    expect(push).toHaveBeenCalledWith('/services?service_code=idc');
    expect(screen.queryByTestId('reason')).toBeNull();
  });

  it('shows the failure frame when the request fails before the deadline', async () => {
    await openMoveDialog();

    getServicesPage.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      fireEvent.click(screen.getByText('이동하기'));
    });

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId('reason').textContent).toContain('서버가 응답하지 못했습니다');
  });
});
