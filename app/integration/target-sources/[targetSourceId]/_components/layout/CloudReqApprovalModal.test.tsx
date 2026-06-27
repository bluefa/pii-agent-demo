// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

const updateConfirmationMock = vi.fn();
const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  updateTestConnectionConfirmation: (...args: unknown[]) => updateConfirmationMock(...args),
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

const toastError = vi.fn();
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn(), info: vi.fn() }),
}));

import { CloudReqApprovalModal } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';

const resource: ConfirmedResource = {
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  resourceName: 'space-prod',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'Key1',
  connectionStatus: 'CONNECTED',
};

const renderModal = (onSubmit = vi.fn()) => {
  render(
    <CloudReqApprovalModal
      isOpen
      onClose={() => {}}
      resources={[resource]}
      providerLabel="Azure Infrastructure"
      targetSourceId={42}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe('CloudReqApprovalModal', () => {
  beforeEach(() => {
    updateConfirmationMock.mockReset();
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue([]);
    toastError.mockReset();
  });

  it('PUTs the completion acknowledgment (confirmed:true) then calls onSubmit', async () => {
    updateConfirmationMock.mockResolvedValue({ targetSourceId: 42, confirmed: true, confirmedAt: '' });
    const onSubmit = renderModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '요청하기' }));
    });

    expect(updateConfirmationMock).toHaveBeenCalledWith(42, true);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('does NOT call onSubmit and surfaces an error toast when the PUT fails', async () => {
    updateConfirmationMock.mockRejectedValue(new Error('boom'));
    const onSubmit = renderModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '요청하기' }));
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
