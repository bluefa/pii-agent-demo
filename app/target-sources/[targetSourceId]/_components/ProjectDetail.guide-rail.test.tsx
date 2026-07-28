// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';

vi.mock('@/app/target-sources/[targetSourceId]/_components/ServiceListPanel', () => ({
  ServiceListPanel: () => null,
}));

vi.mock('@/app/target-sources/[targetSourceId]/_components/aws', () => ({
  AwsProjectPage: () => <div data-testid="aws-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/azure', () => ({
  AzureProjectPage: () => <div data-testid="azure-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/gcp', () => ({
  GcpProjectPage: () => <div data-testid="gcp-page" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/idc', () => ({
  IdcProjectPage: () => <div data-testid="idc-page" />,
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
  resolveProjectStepSlot: vi.fn(() => 'stub-slot-key'),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      GuidePanel: ({ slotKey }: { slotKey: string | null }) => (
        <div data-testid="guide-panel" data-slot-key={slotKey ?? ''} />
      ),
    };
  },
);

import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';

const azureFixture: TargetSource = {
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Azure PII Agent - DB integration',
  description: 'Azure SQL, PostgreSQL, MySQL resources',
  isRejected: false,
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
};

// Lifted from the per-step guide-card tests: the guide mounts once as the
// full-height right rail (GuidePanel) with the slot key resolved from the project.
describe('ProjectDetail guide rail', () => {
  it('renders the GuidePanel rail next to the provider page with the resolved slot key', () => {
    render(<ProjectDetail initialProject={azureFixture} jiraTicket={null} />);

    expect(screen.getByTestId('azure-page')).toBeTruthy();
    const panel = screen.getByTestId('guide-panel');
    expect(panel.getAttribute('data-slot-key')).toBe('stub-slot-key');
  });
});
