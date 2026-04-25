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
  it('mounts CloudTargetSourceLayout on INSTALLING', () => {
    render(
      <GcpProjectPage
        project={{ ...gcpBaseFixture, processStatus: ProcessStatus.INSTALLING }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
  });

  it('mounts CloudTargetSourceLayout on WAITING_CONNECTION_TEST', () => {
    render(
      <GcpProjectPage
        project={{ ...gcpBaseFixture, processStatus: ProcessStatus.WAITING_CONNECTION_TEST }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('legacy-resource-section')).toBeNull();
  });

  it('keeps legacy ResourceSection on steps 1-3 (e.g. WAITING_TARGET_CONFIRMATION)', () => {
    render(
      <GcpProjectPage
        project={{ ...gcpBaseFixture, processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('legacy-resource-section')).toBeTruthy();
    expect(screen.queryByTestId('cloud-target-source-layout-sentinel')).toBeNull();
  });
});
