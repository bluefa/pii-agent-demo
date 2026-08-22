// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: { status: 'ready', data: [{ resourceId: 'res-1' }] } as const,
      retry: () => {},
    }),
  }),
);

const connectionTestCardProps = vi.fn();
vi.mock('@/app/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard', () => ({
  ConnectionTestCard: (props: { confirmed: unknown[]; targetSourceId: number }) => {
    connectionTestCardProps(props);
    return <div data-testid="connection-test-card" data-count={props.confirmed.length} />;
  },
}));

vi.mock('@/app/lib/api', () => ({
  getProject: vi.fn().mockResolvedValue(undefined),
}));

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

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views',
  () => ({
    ResourceTableSkeleton: () => null,
    ErrorRow: () => null,
  }),
);

import { WaitingConnectionTestStep } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingConnectionTestStep';

const azureWaitingConnectionTestFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'proj-1',
  targetSourceId: 1010,
  projectCode: 'PROJ-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test project',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'Azure',
  identifiers: [],
};

describe('WaitingConnectionTestStep', () => {
  it('renders the consolidated ConnectionTestCard fed by the confirmed-integration context', () => {
    connectionTestCardProps.mockClear();
    render(
      <WaitingConnectionTestStep
        project={azureWaitingConnectionTestFixture}
        providerLabel="Azure Infrastructure"
        onProjectUpdate={() => {}}
      />,
    );

    const card = screen.getByTestId('connection-test-card');
    expect(card.getAttribute('data-count')).toBe('1');
    // 카드가 그리는 행이 컨텍스트에서 온 그 행인지 — 개수만으로는 다른 목록도 통과한다.
    // providerLabel 은 승인 모달의 eyebrow 하나만 쓰던 값이라, 모달이 공용 확인 문법으로
    // 옮겨가며 함께 사라졌다.
    expect(connectionTestCardProps).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: [{ resourceId: 'res-1' }] }),
    );
  });

});
