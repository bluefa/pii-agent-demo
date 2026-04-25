// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/aws/AwsInstallationStatus',
  () => ({
    AwsInstallationStatus: () => <div data-testid="aws-installation-status-stub" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/azure/AzureInstallationStatus',
  () => ({
    AzureInstallationStatus: () => <div data-testid="azure-installation-status-stub" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/gcp/GcpInstallationStatus',
  () => ({
    GcpInstallationStatus: () => <div data-testid="gcp-installation-status-stub" />,
  }),
);

import { InstallationStatusSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallationStatusSlot';

const baseProject: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 1003,
  projectCode: 'PROJ-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test project',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
};

describe('InstallationStatusSlot dispatch', () => {
  it('renders AwsInstallationStatus for AWS projects', () => {
    render(
      <InstallationStatusSlot
        project={{ ...baseProject, cloudProvider: 'AWS' }}
        refreshProject={() => {}}
      />,
    );
    expect(screen.getByTestId('aws-installation-status-stub')).toBeTruthy();
    expect(screen.queryByTestId('azure-installation-status-stub')).toBeNull();
    expect(screen.queryByTestId('gcp-installation-status-stub')).toBeNull();
  });

  it('renders AzureInstallationStatus for Azure projects', () => {
    render(
      <InstallationStatusSlot
        project={{ ...baseProject, cloudProvider: 'Azure' }}
        refreshProject={() => {}}
      />,
    );
    expect(screen.getByTestId('azure-installation-status-stub')).toBeTruthy();
    expect(screen.queryByTestId('aws-installation-status-stub')).toBeNull();
    expect(screen.queryByTestId('gcp-installation-status-stub')).toBeNull();
  });

  it('renders GcpInstallationStatus for GCP projects', () => {
    render(
      <InstallationStatusSlot
        project={{ ...baseProject, cloudProvider: 'GCP' }}
        refreshProject={() => {}}
      />,
    );
    expect(screen.getByTestId('gcp-installation-status-stub')).toBeTruthy();
    expect(screen.queryByTestId('aws-installation-status-stub')).toBeNull();
    expect(screen.queryByTestId('azure-installation-status-stub')).toBeNull();
  });

  it('keeps the installation-status wrapper around the inner adapter', () => {
    render(
      <InstallationStatusSlot
        project={{ ...baseProject, cloudProvider: 'Azure' }}
        refreshProject={() => {}}
      />,
    );
    const wrapper = screen.getByTestId('installation-status');
    expect(wrapper.querySelector('[data-testid="azure-installation-status-stub"]')).toBeTruthy();
  });
});
