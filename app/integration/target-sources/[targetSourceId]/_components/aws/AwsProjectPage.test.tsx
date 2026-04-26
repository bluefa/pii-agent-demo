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

vi.mock('@/app/components/features/process-status/aws/AwsInstallationModeSelector', () => ({
  AwsInstallationModeSelector: () => <div data-testid="aws-installation-mode-selector-sentinel" />,
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
      DeleteInfrastructureButton: () => null,
    };
  },
);

import { AwsProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage';

const awsBaseFixture: CloudTargetSource = {
  id: 'aws-proj-1',
  targetSourceId: 1008,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'AWS PII Agent - DB 연동',
  description: 'AWS RDS, EC2 리소스에 PII Agent 설치',
  isRejected: false,
  cloudProvider: 'AWS',
  awsAccountId: '123456789012',
  awsInstallationMode: 'AUTO',
};

describe('AwsProjectPage routing', () => {
  it.each([
    ProcessStatus.WAITING_TARGET_CONFIRMATION,
    ProcessStatus.WAITING_APPROVAL,
    ProcessStatus.APPLYING_APPROVED,
    ProcessStatus.INSTALLING,
    ProcessStatus.WAITING_CONNECTION_TEST,
    ProcessStatus.CONNECTION_VERIFIED,
    ProcessStatus.INSTALLATION_COMPLETE,
  ])(
    'mounts CloudTargetSourceLayout for processStatus=%s when awsInstallationMode is set',
    (status) => {
      render(
        <AwsProjectPage
          project={{ ...awsBaseFixture, processStatus: status }}
          onProjectUpdate={() => {}}
        />,
      );
      expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
      expect(screen.queryByTestId('aws-installation-mode-selector-sentinel')).toBeNull();
    },
  );

  it('mounts AwsInstallationModeSelector when awsInstallationMode is missing', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, awsInstallationMode: undefined }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('aws-installation-mode-selector-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });

  it('keeps AwsInstallationModeSelector even on WAITING_APPROVAL when awsInstallationMode is missing (defensive)', () => {
    render(
      <AwsProjectPage
        project={{
          ...awsBaseFixture,
          processStatus: ProcessStatus.WAITING_APPROVAL,
          awsInstallationMode: undefined,
        }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('aws-installation-mode-selector-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });
});
