// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

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
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/TargetConfirmationInstructionCard',
  () => ({
    TargetConfirmationInstructionCard: () => <div data-testid="target-confirmation-instruction-stub" />,
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
      RejectionAlert: () => null,
    };
  },
);

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
}));

import { WaitingTargetConfirmationStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep';

const awsWaitingTargetConfirmationFixture: CloudTargetSource = {
  id: 'aws-proj-1',
  targetSourceId: 1002,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'AWS PII Agent - DB integration',
  description: 'AWS RDS resources',
  isRejected: false,
  cloudProvider: 'AWS',
  awsInstallationMode: 'AUTO',
  awsAccountId: '123456789012',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'AWS',
  monitoringMethod: 'AWS Agent',
  jiraLink: null,
  identifiers: [],
};

describe('WaitingTargetConfirmationStep DOM order', () => {
  it('renders target-confirmation-instructions before candidate-resource-section', () => {
    render(
      <WaitingTargetConfirmationStep
        project={awsWaitingTargetConfirmationFixture}
        identity={identityFixture}
        providerLabel="AWS Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const instructions = screen.getByTestId('target-confirmation-instructions');
    const candidate = screen.getByTestId('candidate-resource-section');
    const ordering = instructions.compareDocumentPosition(candidate);
    expect(ordering & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
