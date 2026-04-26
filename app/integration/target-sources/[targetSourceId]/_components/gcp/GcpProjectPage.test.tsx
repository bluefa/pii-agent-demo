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

import { GcpProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage';

const gcpBaseFixture: CloudTargetSource = {
  id: 'gcp-proj-1',
  targetSourceId: 1020,
  projectCode: 'GCP-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'GCP PII Agent - DB 연동',
  description: 'GCP Cloud SQL 리소스에 PII Agent 설치',
  isRejected: false,
  cloudProvider: 'GCP',
  gcpProjectId: 'gcp-fixture-1',
};

describe('GcpProjectPage routing', () => {
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
      <GcpProjectPage
        project={{ ...gcpBaseFixture, processStatus: status }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });
});
