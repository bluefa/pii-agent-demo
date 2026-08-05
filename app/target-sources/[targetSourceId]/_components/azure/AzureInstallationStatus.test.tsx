// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import type { ConfirmedResource } from '@/lib/types/resources';

let confirmedState: AsyncState<readonly ConfirmedResource[]> = { status: 'loading' };

vi.mock('@/app/components/features/process-status/azure/AzureInstallationInline', () => ({
  AzureInstallationInline: ({ confirmedLoading }: { confirmedLoading?: boolean }) => (
    <div data-testid="azure-install-inline" data-confirmed-loading={String(confirmedLoading)} />
  ),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    useConfirmedIntegration: () => ({ targetSourceId: 1003, state: confirmedState, retry: () => {} }),
  }),
);

import { AzureInstallationStatus } from '@/app/target-sources/[targetSourceId]/_components/azure/AzureInstallationStatus';

const renderStatus = () =>
  render(<AzureInstallationStatus targetSourceId={1003} refreshProject={() => {}} />);

describe('AzureInstallationStatus', () => {
  it('mounts the install card in skeleton mode while 확정 연동 is still loading', () => {
    confirmedState = { status: 'loading' };
    renderStatus();
    expect(screen.getByTestId('azure-install-inline').dataset.confirmedLoading).toBe('true');
  });

  it('drops the skeleton once the confirmed rows land', () => {
    confirmedState = { status: 'ready', data: [] };
    renderStatus();
    expect(screen.getByTestId('azure-install-inline').dataset.confirmedLoading).toBe('false');
  });

  it('renders nothing when the confirmed fetch failed', () => {
    confirmedState = { status: 'error', message: 'boom' };
    renderStatus();
    expect(screen.queryByTestId('azure-install-inline')).toBeNull();
  });
});
