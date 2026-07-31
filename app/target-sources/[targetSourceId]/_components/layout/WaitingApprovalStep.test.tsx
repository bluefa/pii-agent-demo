// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
  cancelApprovalRequest: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton',
  () => ({
    WaitingApprovalCancelButton: () => <div data-testid="waiting-approval-cancel-button" />,
  }),
);

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard',
  () => ({
    WaitingApprovalCard: ({
      targetSourceId,
      cancelSlot,
    }: {
      targetSourceId: number;
      cancelSlot?: ReactNode;
    }) => (
      <div data-testid="waiting-approval-card">
        {targetSourceId}
        <div data-testid="cancel-slot">{cancelSlot}</div>
      </div>
    ),
  }),
);

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      ProjectPageMeta: () => null,
      RejectionAlert: ({ project }: { project: { isRejected: boolean } }) =>
        project.isRejected ? <div data-testid="rejection-alert" /> : null,
    };
  },
);

import { WaitingApprovalStep } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep';

const azureWaitingApprovalFixture: CloudTargetSource = {
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
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
  jiraLink: null,
  identifiers: [],
};

describe('WaitingApprovalStep', () => {
  it('renders WaitingApprovalCard with the project targetSourceId and a cancel button slot', () => {
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
    expect(card.textContent).toContain('1003');
    expect(screen.getByTestId('waiting-approval-cancel-button')).toBeTruthy();
  });

  // Rejection now comes from approval-requests/latest inside the card, not from the project
  // payload — the wire DTO has no rejection fields, so project.isRejected is always false.
  it('keeps the cancel button slot and renders no rejection alert regardless of project.isRejected', () => {
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
    expect(screen.queryByTestId('rejection-alert')).toBeNull();
    expect(screen.getByTestId('waiting-approval-cancel-button')).toBeTruthy();
  });
});
