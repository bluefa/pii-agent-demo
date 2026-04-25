// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout',
  () => ({
    CloudTargetSourceLayout: () => <div data-testid="cloud-target-source-layout-sentinel" />,
  }),
);

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => null,
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection',
  () => ({
    ResourceSection: () => <div data-testid="legacy-resource-section" />,
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
      DeleteInfrastructureButton: () => null,
    };
  },
);

import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage';

const azureInstallingFixture: CloudTargetSource = {
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  name: 'Azure PII Agent - DB 연동',
  description: 'Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  isRejected: false,
};

const azureWaitingTargetConfirmationFixture: CloudTargetSource = {
  id: 'azure-proj-3',
  targetSourceId: 1005,
  projectCode: 'AZURE-003',
  name: 'Azure PII Agent - VM+MySQL 스캔 완료',
  description: 'VM 1대 + MySQL 1대, 스캔 완료 후 연동 대상 확정 전',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  tenantId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  subscriptionId: '34567890-cdef-0123-4567-89abcdef0123',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  createdAt: '2026-02-05T09:00:00Z',
  updatedAt: '2026-02-09T10:00:00Z',
  isRejected: false,
};

const azureWaitingConnectionTestFixture: CloudTargetSource = {
  ...azureInstallingFixture,
  id: 'azure-proj-4',
  targetSourceId: 1011,
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
};

describe('AzureProjectPage routing', () => {
  it('mounts CloudTargetSourceLayout when processStatus === INSTALLING', async () => {
    render(<AzureProjectPage project={azureInstallingFixture} onProjectUpdate={() => {}} />);
    expect(await screen.findByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });

  it('mounts CloudTargetSourceLayout on WAITING_CONNECTION_TEST', async () => {
    render(
      <AzureProjectPage
        project={azureWaitingConnectionTestFixture}
        onProjectUpdate={() => {}}
      />,
    );
    expect(await screen.findByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });

  it('does not mount CloudTargetSourceLayout for steps 1-3', () => {
    render(
      <AzureProjectPage
        project={azureWaitingTargetConfirmationFixture}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });
});
