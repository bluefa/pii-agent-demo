// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: { status: 'ready', data: [] } as const,
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
    ConfirmedResourcesSlot: () => <div data-testid="confirmed-resources-slot" />,
  }),
);

import { InstallationCompleteStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep';

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

describe('InstallationCompleteStep', () => {
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

  it('renders the Step 7 title', () => {
    renderStep();
    expect(screen.getByText('PII 모니터링 모듈 연동 완료')).toBeTruthy();
  });

  it('mounts the ConfirmedResourcesSlot', () => {
    renderStep();
    expect(screen.getByTestId('confirmed-resources-slot')).toBeTruthy();
  });

  it('does not render the 승인 대기 pill (that is Step 6)', () => {
    renderStep();
    expect(screen.queryByText('승인 대기')).toBeNull();
  });
});
