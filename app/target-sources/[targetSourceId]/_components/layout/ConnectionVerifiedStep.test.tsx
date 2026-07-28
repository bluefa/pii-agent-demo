// @vitest-environment jsdom
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

const updateConfirmationMock = vi.fn();
const getProjectMock = vi.fn();
// The unified ProjectPageMeta header mounts the stepper; stub the animated bar
// (its reduced-motion hook needs window.matchMedia, absent in jsdom).
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: () => null,
}));

vi.mock('@/app/lib/api', () => ({
  updateTestConnectionConfirmation: (...args: unknown[]) => updateConfirmationMock(...args),
  getProject: (...args: unknown[]) => getProjectMock(...args),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: { status: 'ready', data: [] } as const,
      retry: () => {},
    }),
  }),
);

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot',
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

import { ConnectionVerifiedStep } from '@/app/target-sources/[targetSourceId]/_components/layout/ConnectionVerifiedStep';

const projectFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 2001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
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
  jiraLink: null,
  identifiers: [],
};

describe('ConnectionVerifiedStep', () => {
  beforeEach(() => {
    updateConfirmationMock.mockReset();
    updateConfirmationMock.mockResolvedValue({ targetSourceId: 2001, confirmed: false, confirmedAt: '' });
    getProjectMock.mockReset();
    getProjectMock.mockResolvedValue(projectFixture);
  });

  const renderStep = (onProjectUpdate: (p: CloudTargetSource) => void = () => {}) =>
    render(
      <ConnectionVerifiedStep
        project={projectFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={onProjectUpdate}
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

  it('opens the retest confirm modal when the retest button is clicked', () => {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /연결 테스트 재실행/ }));
    expect(screen.getByText('연결 테스트를 다시 실행할까요?')).toBeTruthy();
  });

  it('되돌아가기 rolls back the acknowledgment (confirmed:false) then refetches the project', async () => {
    const onProjectUpdate = vi.fn();
    renderStep(onProjectUpdate);
    fireEvent.click(screen.getByRole('button', { name: /연결 테스트 재실행/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }));
    });
    expect(updateConfirmationMock).toHaveBeenCalledWith(2001, false);
    await waitFor(() => expect(getProjectMock).toHaveBeenCalledWith(2001));
    await waitFor(() => expect(onProjectUpdate).toHaveBeenCalledWith(projectFixture));
  });


  it('renders the card title with the cardTitle token (v15 26px / font-extrabold)', () => {
    renderStep();
    const h2 = screen.getByRole('heading', { level: 2, name: /완료 여부 관리자 승인 대기/ });
    expect(h2.className).toContain('text-[22px]');
    expect(h2.className).toContain('font-extrabold');
  });
});
