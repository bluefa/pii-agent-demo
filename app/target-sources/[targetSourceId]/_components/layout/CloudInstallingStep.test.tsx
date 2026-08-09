// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';

vi.mock('@/app/components/features/process-status/azure/AzureInstallationInline', () => ({
  AzureInstallationInline: () => <div data-testid="azure-install-stub" />,
}));

vi.mock('@/app/components/features/process-status/gcp/GcpInstallationInline', () => ({
  GcpInstallationInline: () => <div data-testid="gcp-install-stub" />,
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: { status: 'ready', data: [] } as const,
      retry: () => {},
    }),
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
      RejectionAlert: () => null,
    };
  },
);

import { CloudInstallingStep } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep';

const azureInstallingFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Azure PII Agent - DB integration',
  description: 'Azure SQL, PostgreSQL, MySQL resources',
  isRejected: false,
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
};

const renderStep = (
  overrides: Partial<Parameters<typeof CloudInstallingStep>[0]> = {},
) =>
  render(
    <CloudInstallingStep
      project={azureInstallingFixture}
      onProjectUpdate={() => {}}
      {...overrides}
    />,
  );

describe('CloudInstallingStep DOM order', () => {
  it('renders installation-status and omits the redundant confirmed-resources card', () => {
    renderStep();

    expect(screen.getByTestId('installation-status')).toBeTruthy();
    // The standalone "연동 대상 정보" card duplicated the install table (not in v15) — removed.
    expect(screen.queryByTestId('confirmed-resources')).toBeNull();
  });
});


describe('CloudInstallingStep GCP fork', () => {
  it('omits the redundant confirmed-resources card for GCP too', () => {
    const gcpFixture: CloudTargetSource = {
      ...azureInstallingFixture,
      cloudProvider: 'GCP',
    };
    renderStep({ project: gcpFixture });
    expect(screen.queryByTestId('confirmed-resources')).toBeNull();
  });
});
