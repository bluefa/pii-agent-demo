// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock('@/app/components/features/process-status', () => ({
  ConnectionTestPanel: () => null,
}));

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
  ProcessStatusCard: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: () => null,
}));

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/integration/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      ProjectPageMeta: () => null,
      RejectionAlert: () => null,
    };
  },
);

vi.mock('@/lib/theme', () => ({
  cardStyles: { base: '', header: '' },
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  textColors: { primary: '', tertiary: '' },
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable',
  () => ({
    ConfirmedIntegrationTable: () => null,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views',
  () => ({
    LoadingRow: () => null,
    ErrorRow: () => null,
  }),
);

import { ConnectionTestStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestStep';

const azureWaitingConnectionTestFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 1010,
  projectCode: 'PROJ-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test project',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'Azure',
  monitoringMethod: 'Azure Agent',
  jiraLink: null,
  identifiers: [],
};

describe('ConnectionTestStep DOM order', () => {
  it('renders confirmed-resources before connection-test', () => {
    render(
      <ConnectionTestStep
        project={azureWaitingConnectionTestFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const confirmed = screen.getByTestId('confirmed-resources');
    const connection = screen.getByTestId('connection-test');
    const ordering = confirmed.compareDocumentPosition(connection);
    expect(ordering & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
