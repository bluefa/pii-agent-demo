// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: { status: 'ready', data: [] } as const,
      retry: () => {},
    }),
  }),
);

vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => <div data-testid="process-status-card" />,
}));

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
    <div data-testid="guide-card-container" data-slot-key={slotKey} />
  ),
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => null),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot',
  () => ({
    ConfirmedResourcesSlot: () => <div data-testid="confirmed-resources-slot" />,
  }),
);

const toastInfo = vi.fn();

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: toastInfo,
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { ConnectionVerifiedStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionVerifiedStep';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';

const projectFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 2001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.CONNECTION_VERIFIED,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'Azure',
  monitoringMethod: 'Azure Agent',
  jiraLink: null,
  identifiers: [],
};

describe('ConnectionVerifiedStep', () => {
  const renderStep = () =>
    render(
      <ConnectionVerifiedStep
        project={projectFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

  it('renders the Step 6 title and subtitle', () => {
    renderStep();
    expect(screen.getByText('완료 여부 관리자 승인 대기')).toBeTruthy();
  });

  it('renders the 승인 대기 status pill', () => {
    renderStep();
    expect(screen.getByText('승인 대기')).toBeTruthy();
  });

  it('renders the banner copy', () => {
    renderStep();
    expect(screen.getByText('최종 관리자 승인을 기다리고 있어요.')).toBeTruthy();
  });

  it('mounts the ConfirmedResourcesSlot', () => {
    renderStep();
    expect(screen.getByTestId('confirmed-resources-slot')).toBeTruthy();
  });

  it('renders the 연결 테스트 재실행 button', () => {
    renderStep();
    expect(screen.getByRole('button', { name: /연결 테스트 재실행/ })).toBeTruthy();
  });

  it('fires toast.info when the retest button is clicked', () => {
    toastInfo.mockClear();
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /연결 테스트 재실행/ }));
    expect(toastInfo).toHaveBeenCalledWith('연결 테스트 재실행 기능 준비중입니다.');
  });

  it('mounts GuideCardContainer when the resolver returns a slot key', () => {
    const slotKey = 'process.azure.6' satisfies GuideSlotKey;
    vi.mocked(resolveStepSlot).mockReturnValueOnce(slotKey);
    renderStep();
    const guide = screen.getByTestId('guide-card-container');
    expect(guide).toBeTruthy();
    expect(guide.getAttribute('data-slot-key')).toBe(slotKey);
  });

  it('renders the card title with the cardTitle token (v15 26px / font-extrabold)', () => {
    renderStep();
    const h2 = screen.getByRole('heading', { level: 2, name: /완료 여부 관리자 승인 대기/ });
    expect(h2.className).toContain('text-[26px]');
    expect(h2.className).toContain('font-extrabold');
  });
});
