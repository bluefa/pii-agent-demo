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

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/integration/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      DeleteInfrastructureButton: () => null,
    };
  },
);

import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage';

const azureBaseFixture: CloudTargetSource = {
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

describe('AzureProjectPage routing', () => {
  it.each([
    ProcessStatus.WAITING_TARGET_CONFIRMATION,
    ProcessStatus.WAITING_APPROVAL,
    ProcessStatus.APPLYING_APPROVED,
    ProcessStatus.INSTALLING,
    ProcessStatus.WAITING_CONNECTION_TEST,
    ProcessStatus.CONNECTION_VERIFIED,
    ProcessStatus.INSTALLATION_COMPLETE,
  ])('mounts CloudTargetSourceLayout for processStatus=%s', (status) => {
    render(
      <AzureProjectPage
        project={{ ...azureBaseFixture, processStatus: status }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });
});
