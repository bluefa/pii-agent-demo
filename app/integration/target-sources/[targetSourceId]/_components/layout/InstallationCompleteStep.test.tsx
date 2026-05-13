// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

let providerState: { status: 'loading' | 'ready' | 'error'; data?: ConfirmedResource[]; message?: string } = {
  status: 'ready',
  data: [],
};

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: providerState,
      retry: () => {},
    }),
  }),
);

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => <div data-testid="process-status-card" />,
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot',
  () => ({
    ConfirmedResourcesSlot: ({ variant }: { variant?: string }) => (
      <div data-testid="confirmed-resources-slot" data-variant={variant ?? 'pre-install'} />
    ),
  }),
);

const toastInfo = vi.fn();

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: toastInfo,
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { InstallationCompleteStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep';

const makeResource = (
  overrides: Partial<ConfirmedResource> = {},
): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'MYSQL',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'cred-1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

const projectFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 3001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'Azure',
  monitoringMethod: 'Azure Agent',
  jiraLink: null,
  identifiers: [],
};

const renderStep = () =>
  render(
    <InstallationCompleteStep
      project={projectFixture}
      identity={identityFixture}
      providerLabel="Azure Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

describe('InstallationCompleteStep', () => {
  it('renders the Step 7 title', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByText('PII 모니터링 모듈 연동 완료')).toBeTruthy();
  });

  it('mounts the ConfirmedResourcesSlot with complete variant', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    const slot = screen.getByTestId('confirmed-resources-slot');
    expect(slot.getAttribute('data-variant')).toBe('complete');
  });

  it('does not render the 승인 대기 pill (that is Step 6)', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.queryByText('승인 대기')).toBeNull();
  });

  it('shows Healthy in the header when every confirmed resource is CONNECTED', () => {
    providerState = {
      status: 'ready',
      data: [
        makeResource({ resourceId: 'r1', connectionStatus: 'CONNECTED' }),
        makeResource({ resourceId: 'r2', connectionStatus: 'CONNECTED' }),
      ],
    };
    renderStep();
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.queryByText('Unhealthy')).toBeNull();
  });

  it('shows Unhealthy in the header when any confirmed resource is DISCONNECTED', () => {
    providerState = {
      status: 'ready',
      data: [
        makeResource({ resourceId: 'r1', connectionStatus: 'CONNECTED' }),
        makeResource({ resourceId: 'r2', connectionStatus: 'DISCONNECTED' }),
      ],
    };
    renderStep();
    expect(screen.getByText('Unhealthy')).toBeTruthy();
    expect(screen.queryByText('Healthy')).toBeNull();
  });

  it('omits the header badge while loading', () => {
    providerState = { status: 'loading' };
    renderStep();
    expect(screen.queryByText('Healthy')).toBeNull();
    expect(screen.queryByText('Unhealthy')).toBeNull();
  });

  it('renders both action buttons', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByRole('button', { name: /인프라 변경/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연결 테스트 재실행/ })).toBeTruthy();
  });

  it('fires toast.info when 인프라 변경 is clicked', () => {
    providerState = { status: 'ready', data: [] };
    toastInfo.mockClear();
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /인프라 변경/ }));
    expect(toastInfo).toHaveBeenCalledWith('인프라 변경 기능 준비중입니다.');
  });

  it('fires toast.info when 연결 테스트 재실행 is clicked', () => {
    providerState = { status: 'ready', data: [] };
    toastInfo.mockClear();
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /연결 테스트 재실행/ }));
    expect(toastInfo).toHaveBeenCalledWith('연결 테스트 재실행 기능 준비중입니다.');
  });
});
