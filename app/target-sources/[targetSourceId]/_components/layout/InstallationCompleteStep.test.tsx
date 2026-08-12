// @vitest-environment jsdom
import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
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
const toastError = vi.fn();

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastError,
    info: toastInfo,
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const resetTargetSourceMock = vi.fn();
const updateConfirmationMock = vi.fn();
const getProjectMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  resetTargetSource: (...args: unknown[]) => resetTargetSourceMock(...args),
  updateTestConnectionConfirmation: (...args: unknown[]) => updateConfirmationMock(...args),
  getProject: (...args: unknown[]) => getProjectMock(...args),
}));

import { InstallationCompleteStep } from '@/app/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep';

/** 손으로 결말을 정하는 프라미스 — 요청이 떠 있는 동안의 화면을 보기 위한 것. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

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
  isTerraformExecutionGranted: false,
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
  identifiers: [],
};

const renderStep = () =>
  render(
    <InstallationCompleteStep
      project={projectFixture}
      onProjectUpdate={() => {}}
    />,
  );

describe('InstallationCompleteStep', () => {
  it('renders the step tag, the title, the 연동 완료 badge and the guidance pair', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    expect(screen.getByText('7단계')).toBeTruthy();
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


  describe('rewind dispatch', () => {
    // 모달을 여는 클릭과 확인 클릭은 서로 다른 커밋이다 — 한 act 안에 묶으면 사유 입력란이
    // 아직 DOM 에 없다.
    const confirmInfra = async (reason = '운영 DB를 신규 VPC로 이전합니다.') => {
      fireEvent.click(screen.getByRole('button', { name: /인프라 변경/ }));
      fireEvent.change(screen.getByLabelText('초기화 사유'), { target: { value: reason } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });
    };

    beforeEach(() => {
      providerState = { status: 'ready', data: [] };
      resetTargetSourceMock.mockReset().mockResolvedValue({ success: true });
      updateConfirmationMock.mockReset().mockResolvedValue({});
      getProjectMock.mockReset().mockResolvedValue(projectFixture);
      toastError.mockReset();
    });

    it('sends the trimmed reason to the reset endpoint, then refreshes the project', async () => {
      const onProjectUpdate = vi.fn();
      render(
        <InstallationCompleteStep project={projectFixture} onProjectUpdate={onProjectUpdate} />,
      );
      await confirmInfra('  사유  ');
      expect(resetTargetSourceMock).toHaveBeenCalledWith(3001, '사유');
      expect(onProjectUpdate).toHaveBeenCalledWith(projectFixture);
    });

    /**
     * 뮤테이션이 끝난 뒤 project 를 다시 읽는 구간에는 화면이 아직 되감기 전 단계를 보여준다.
     * 그때 버튼이 살아 있으면, 이미 초기화된 과제에 두 번째 초기화가 나간다.
     */
    it('locks both rewind buttons until the post-mutation refresh settles', async () => {
      const refresh = deferred<CloudTargetSource>();
      getProjectMock.mockReturnValue(refresh.promise);
      render(<InstallationCompleteStep project={projectFixture} onProjectUpdate={() => {}} />);

      await confirmInfra();
      expect(screen.getByRole('button', { name: /인프라 변경/ })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /연결 테스트 재실행/ })).toHaveProperty('disabled', true);

      await act(async () => {
        refresh.resolve(projectFixture);
      });
      expect(screen.getByRole('button', { name: /인프라 변경/ })).toHaveProperty('disabled', false);
    });

    // 되돌리기는 됐는데 화면만 못 따라간 경우 — "실패했습니다"로 뭉뚱그리면 사용자가 한 번 더
    // 누르고, 그때는 이미 되돌아간 뒤라 두 번째 요청이 엉뚱한 단계에서 나간다.
    it('reports a refresh failure as a refresh failure, not as a failed rewind', async () => {
      getProjectMock.mockRejectedValue(new Error('boom'));
      render(<InstallationCompleteStep project={projectFixture} onProjectUpdate={() => {}} />);
      await confirmInfra();
      expect(resetTargetSourceMock).toHaveBeenCalledOnce();
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('화면을 갱신하지 못했어요'));
    });

    it('keeps the dialog open and does not close on a failed rewind', async () => {
      resetTargetSourceMock.mockRejectedValue(new Error('boom'));
      render(<InstallationCompleteStep project={projectFixture} onProjectUpdate={() => {}} />);
      await confirmInfra();
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('인프라 변경'));
      expect(screen.getByText('인프라를 변경할까요?')).toBeTruthy();
      expect(getProjectMock).not.toHaveBeenCalled();
    });
  });

  it('renders the card title with the cardTitle token (v15 26px / font-extrabold)', () => {
    providerState = { status: 'ready', data: [] };
    renderStep();
    const h2 = screen.getByRole('heading', { level: 2, name: /PII 모니터링 모듈 연동/ });
    expect(h2.className).toContain('text-[22px]');
    expect(h2.className).toContain('font-extrabold');
  });
});
