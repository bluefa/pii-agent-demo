// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

let providerState: { status: 'loading' | 'ready' | 'error'; data?: ConfirmedResource[]; message?: string } = {
  status: 'ready',
  data: [],
};

// The unified ProjectPageMeta header mounts the stepper; stub the animated bar
// (its reduced-motion hook needs window.matchMedia, absent in jsdom).
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: () => null,
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({
      state: providerState,
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

import { InstallationCompleteStep } from '@/app/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep';

const makeResource = (
  overrides: Partial<ConfirmedResource> = {},
): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'MYSQL',
  region: 'ap-northeast-2',
  resourceName: 'res-1',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'cred-1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

const projectFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 3001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
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

const renderStep = () =>
  render(
    <InstallationCompleteStep
      project={projectFixture}
      identity={identityFixture}
      providerLabel="Azure Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

describe('InstallationCompleteStep', () => {
  it('renders the step tag, the title, the 연동 완료 badge and the guidance pair', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByText('7번째 단계')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'PII 모니터링 모듈 연동' })).toBeTruthy();
    expect(screen.getByText('연동 완료')).toBeTruthy();
    expect(screen.getByText(/연동된 리소스의 PII 사용 가능성을 모니터링하고 있어요/)).toBeTruthy();
    expect(screen.getByText(/인프라 구성이 바뀌었다면 하단/)).toBeTruthy();
  });

  it('mounts the ConfirmedResourcesSlot (steps 6·7 shared table)', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByTestId('confirmed-resources-slot')).toBeTruthy();
  });

  it('does not render the 승인 대기 pill (that is Step 6)', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.queryByText('승인 대기')).toBeNull();
  });

  // The per-row Status column left the table (live review), so its header aggregate
  // goes with it — no lone Healthy pill next to the 연동 완료 badge.
  it('renders no header health badge even when resources are CONNECTED', () => {
    providerState = {
      status: 'ready',
      data: [
        makeResource({ resourceId: 'r1', connectionStatus: 'CONNECTED' }),
        makeResource({ resourceId: 'r2', connectionStatus: 'DISCONNECTED' }),
      ],
    };
    renderStep();
    expect(screen.queryByText('Healthy')).toBeNull();
    expect(screen.queryByText('Unhealthy')).toBeNull();
  });

  it('renders both action buttons', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByRole('button', { name: /인프라 변경/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연결 테스트 재실행/ })).toBeTruthy();
  });

  it('opens the infra-change confirm modal when 인프라 변경 is clicked', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /인프라 변경/ }));
    expect(screen.getByText('인프라를 변경할까요?')).toBeTruthy();
  });

  it('opens the retest confirm modal when 연결 테스트 재실행 is clicked', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /연결 테스트 재실행/ }));
    expect(screen.getByText('연결을 다시 확인할까요?')).toBeTruthy();
  });


  it('renders the card title with the cardTitle token (v15 26px / font-extrabold)', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    const h2 = screen.getByRole('heading', { level: 2, name: /PII 모니터링 모듈 연동/ });
    expect(h2.className).toContain('text-[22px]');
    expect(h2.className).toContain('font-extrabold');
  });
});
