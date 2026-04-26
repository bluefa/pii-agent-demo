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
  it('mounts CloudTargetSourceLayout on INSTALLING when awsInstallationMode is set', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.INSTALLING, awsInstallationMode: 'AUTO' }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
    expect(screen.queryByTestId('aws-installation-mode-selector-sentinel')).toBeNull();
  });

  it('mounts AwsInstallationModeSelector when awsInstallationMode is missing', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.INSTALLING, awsInstallationMode: undefined }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('aws-installation-mode-selector-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });

  it('mounts CloudTargetSourceLayout on WAITING_CONNECTION_TEST', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.WAITING_CONNECTION_TEST }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
  });

  it('keeps legacy ResourceSection on steps 1-3 (e.g. WAITING_TARGET_CONFIRMATION)', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('legacy-resource-section')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });

  it('mounts CloudTargetSourceLayout on WAITING_APPROVAL', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.WAITING_APPROVAL }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
  });

  it('mounts CloudTargetSourceLayout on APPLYING_APPROVED', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.APPLYING_APPROVED }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
  });

  it('keeps AwsInstallationModeSelector when awsInstallationMode is missing even on WAITING_APPROVAL (defensive — should not happen in practice but the gate must win)', () => {
    render(
      <AwsProjectPage
        project={{ ...awsBaseFixture, processStatus: ProcessStatus.WAITING_APPROVAL, awsInstallationMode: undefined }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('aws-installation-mode-selector-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });
});
