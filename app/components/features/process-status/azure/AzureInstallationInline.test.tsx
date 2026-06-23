// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureV1InstallationStatus } from '@/lib/types/azure';

// A VM resource whose subnet + load balancer are ready but whose private
// endpoint is still pending → phases 1 & 2 = done, phase 3 = running. This
// gives a clean done/running split for the click-wiring assertions.
const installationStatus: AzureV1InstallationStatus = {
  lastCheck: { status: 'SUCCESS' },
  resources: [
    {
      resourceId: 'vm-1',
      resourceName: 'vm-1',
      resourceType: 'AZURE_VM',
      vmInstallation: { subnetExists: true, loadBalancer: { installed: true } },
      privateEndpoint: { id: 'pe-1', name: 'pe-1', status: 'PENDING_APPROVAL' },
    },
  ],
};

vi.mock('@/app/hooks/useInstallationStatus', () => ({
  useInstallationStatus: () => ({
    status: installationStatus,
    loading: false,
    refreshing: false,
    error: null,
    fetchStatus: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/lib/api/azure', () => ({
  getAzureInstallationStatus: vi.fn(),
  checkAzureInstallation: vi.fn(),
}));

import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';

const confirmed: readonly ConfirmedResource[] = [
  {
    resourceId: 'vm-1',
    type: 'AZURE_VM',
    databaseType: 'AZURE_MYSQL',
    region: 'ap-northeast-1',
    resourceName: 'vm-1',
    host: null,
    port: null,
    oracleServiceId: null,
    networkInterfaceId: null,
    ipConfigurationName: null,
    credentialId: 'Key1',
    connectionStatus: 'CONNECTED',
  },
];

describe('AzureInstallationInline — install-task detail modal wiring (v16 L6598)', () => {
  it('renders the completed phase card as a clickable button', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const doneCard = screen.getByRole('button', { name: /서비스 측 리소스 설치 진행/ });
    expect(doneCard).toBeTruthy();
  });

  it('keeps the running phase card non-interactive (no button)', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    expect(
      screen.queryByRole('button', { name: /Private Link 모듈 설치 진행/ }),
    ).toBeNull();
  });

  it('opens the detail modal when the completed phase card is clicked', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    expect(screen.queryByText('리소스별 설치 진행 현황을 확인할 수 있어요.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /서비스 측 리소스 설치 진행/ }));

    expect(screen.getByText('리소스별 설치 진행 현황을 확인할 수 있어요.')).toBeTruthy();
  });
});
