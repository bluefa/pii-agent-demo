// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard',
  () => ({
    ApplyingApprovedCard: () => <div data-testid="applying-approved-card" />,
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
      RejectionAlert: () => null,
    };
  },
);

import { ApplyingApprovedStep } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep';

const azureApplyingApprovedFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
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
  jiraLink: null,
  identifiers: [],
};

describe('ApplyingApprovedStep', () => {
  it('renders the applying-approved card for the target source', () => {
    render(
      <ApplyingApprovedStep
        project={azureApplyingApprovedFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    expect(screen.getByTestId('applying-approved-card')).toBeTruthy();
  });
});
