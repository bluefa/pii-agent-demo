// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
    <div data-testid="guide-card-container" data-slot-key={slotKey} />
  ),
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard',
  () => ({
    ApplyingApprovedCard: () => <div data-testid="applying-approved-card" />,
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

import { ApplyingApprovedStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep';

const azureApplyingApprovedFixture: CloudTargetSource = {
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.APPLYING_APPROVED,
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

describe('ApplyingApprovedStep DOM order', () => {
  it('renders GuideCardContainer with the resolved slotKey', () => {
    render(
      <ApplyingApprovedStep
        project={azureApplyingApprovedFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const guide = screen.getByTestId('guide-card-container');
    expect(guide.getAttribute('data-slot-key')).toBe('stub-slot-key');
  });

  it('renders guide-card before the applying-approved card', () => {
    render(
      <ApplyingApprovedStep
        project={azureApplyingApprovedFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const guide = screen.getByTestId('guide-card-container');
    const applying = screen.getByTestId('applying-approved-card');

    const guideBeforeApplying = guide.compareDocumentPosition(applying);
    expect(guideBeforeApplying & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
