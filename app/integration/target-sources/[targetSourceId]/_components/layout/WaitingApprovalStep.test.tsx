// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard',
  () => ({
    WaitingApprovalCard: ({ targetSourceId }: { targetSourceId: number }) => (
      <div data-testid="waiting-approval-card">{targetSourceId}</div>
    ),
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/integration/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      ProjectPageMeta: () => null,
      RejectionAlert: ({ project }: { project: { isRejected: boolean } }) =>
        project.isRejected ? <div data-testid="rejection-alert" /> : null,
    };
  },
);

import { WaitingApprovalStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep';

const azureWaitingApprovalFixture: CloudTargetSource = {
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Azure PII Agent - DB integration',
  description: 'Azure SQL, PostgreSQL, MySQL resources',
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

describe('WaitingApprovalStep', () => {
  it('renders WaitingApprovalCard with the project targetSourceId', () => {
    render(
      <WaitingApprovalStep
        project={azureWaitingApprovalFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const card = screen.getByTestId('waiting-approval-card');
    expect(card.textContent).toBe('1003');
  });

  it('still renders WaitingApprovalCard alongside RejectionAlert when project.isRejected', () => {
    render(
      <WaitingApprovalStep
        project={{ ...azureWaitingApprovalFixture, isRejected: true }}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    expect(screen.getByTestId('waiting-approval-card')).toBeTruthy();
    expect(screen.getByTestId('rejection-alert')).toBeTruthy();
  });
});
