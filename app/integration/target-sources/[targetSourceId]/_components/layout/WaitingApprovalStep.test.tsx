// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock('@/app/components/features/process-status/ApprovalWaitingCard', () => ({
  ApprovalWaitingCard: () => <div data-testid="approval-waiting-stub" />,
}));

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: () => null,
}));

vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/candidate', () => ({
  CandidateResourceSection: () => <div data-testid="candidate-resource-section" />,
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

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
}));

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

describe('WaitingApprovalStep DOM order', () => {
  it('renders approval-waiting before candidate-resource-section', () => {
    render(
      <WaitingApprovalStep
        project={azureWaitingApprovalFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const approval = screen.getByTestId('approval-waiting');
    const candidate = screen.getByTestId('candidate-resource-section');
    const ordering = approval.compareDocumentPosition(candidate);
    expect(ordering & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render approval-waiting when project.isRejected is true', () => {
    render(
      <WaitingApprovalStep
        project={{ ...azureWaitingApprovalFixture, isRejected: true }}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    expect(screen.queryByTestId('approval-waiting')).toBeNull();
  });
});
