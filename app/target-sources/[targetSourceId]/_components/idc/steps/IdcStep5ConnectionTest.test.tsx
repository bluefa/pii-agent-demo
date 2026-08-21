// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { TestConnectionVersionResult, TestConnectionStatus } from '@/app/lib/api';
import type { TestConnectionUIState } from '@/app/hooks/useTestConnectionPolling';
import { toIdcResourceView, type IdcResourceView } from '@/app/lib/api/idc';

// Stub the heavy chrome so only the connection-test card (strip + resource panel) renders.
vi.mock('@/app/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: () => null,
  RejectionAlert: () => null,
}));
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  IdentifierTip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn() }),
}));

// Row1 carries a pre-selected credential; the card must open every row PENDING
// (step5 is pre-test). The read source is the confirmed list
// (getIdcConfirmedResources), same as the cloud sibling.
const getIdcConfirmedResources = vi.fn(() => Promise.resolve<IdcResourceView[]>([]));
vi.mock('@/app/lib/api/idc', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api/idc')>('@/app/lib/api/idc');
  return { ...actual, getIdcConfirmedResources: () => getIdcConfirmedResources() };
});

// The step owns its polling (unlike the cloud card, which takes it as a prop) — mock
// the hook module so the slot-state tests can set the run phase directly. The rest
// of the module (isInFlightUi, types) stays real.
const triggerMock = vi.fn(async () => true);
const pollingState: {
  uiState: TestConnectionUIState;
  latestJob: TestConnectionVersionResult | null;
  loading: boolean;
  triggering: boolean;
  canRunTest: boolean;
} = { uiState: 'IDLE', latestJob: null, loading: false, triggering: false, canRunTest: true };
vi.mock('@/app/hooks/useTestConnectionPolling', async () => {
  const actual = await vi.importActual<typeof import('@/app/hooks/useTestConnectionPolling')>(
    '@/app/hooks/useTestConnectionPolling',
  );
  return {
    ...actual,
    useTestConnectionPolling: () => ({
      latestJob: pollingState.latestJob,
      uiState: pollingState.uiState,
      loading: pollingState.loading,
      triggering: pollingState.triggering,
      canRunTest: pollingState.canRunTest,
      retry: async () => {},
      fetchError: null,
      triggerError: null,
      trigger: triggerMock,
    }),
  };
});

// completion-status gates 완료 승인 요청 (useTcCompletionStatus) — default to the open
// verdict so each test only overrides the verdict it is about.
const getCompletionStatusMock = vi.fn(
  async (
    ..._args: unknown[]
  ): Promise<{ test_connection_status: string; logical_database_updated_at?: string }> => ({
    test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS',
  }),
);
const updateResourceCredentialMock = vi.fn(async (..._args: unknown[]) => ({ success: true }));
vi.mock('@/app/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api')>('@/app/lib/api');
  return {
    ...actual,
    getSecrets: async () => [{ name: 'Key1' }, { name: 'Key2' }, { name: 'Key3' }],
    updateResourceCredential: (...args: unknown[]) => updateResourceCredentialMock(...args),
    getTestConnectionCompletionStatus: (...args: unknown[]) => getCompletionStatusMock(...args),
  };
});
// The rejection notice + run-history modal fetch on their own — quiet, empty defaults.
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => ({
    status: 'TEST_CONNECTION_COMPLETED',
    rejectReason: null,
    rejectedAt: null,
  })),
  getTestConnectionExecutionHistory: vi.fn(async () => ({ totalElements: 0, totalPages: 1, content: [] })),
}));

import { IdcStep5ConnectionTest } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep5ConnectionTest';

const seededRows: IdcResourceView[] = [
  toIdcResourceView(
    {
      input_format: 'IP',
      ips: ['10.20.30.40'],
      port: 3306,
      database_type: 'MYSQL',
      credential_id: 'idc_svc_mysql',
    },
    0,
  ),
  toIdcResourceView(
    {
      input_format: 'IP',
      ips: ['10.20.31.10'],
      port: 1521,
      database_type: 'ORACLE',
    },
    1,
  ),
];

const project: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'idc-1',
  targetSourceId: 1020,
  projectCode: 'IDC-025',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'IDC Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'IDC',
};

const identity: ProjectIdentity = {
  cloudProvider: 'IDC',
  identifiers: [],
};

const renderStep = () =>
  render(
    <IdcStep5ConnectionTest
      project={project}
      identity={identity}
      providerLabel="IDC Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

const resetHarness = () => {
  getIdcConfirmedResources.mockResolvedValue(seededRows);
  pollingState.uiState = 'IDLE';
  pollingState.latestJob = null;
  pollingState.loading = false;
  pollingState.triggering = false;
  pollingState.canRunTest = true;
  triggerMock.mockClear();
  // mockClear would leave queued mockResolvedValueOnce verdicts to leak into the
  // next test — reset drains the queue, then restore the default open verdict.
  getCompletionStatusMock.mockReset();
  getCompletionStatusMock.mockResolvedValue({ test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS' });
  updateResourceCredentialMock.mockClear();
};

describe('IdcStep5ConnectionTest — pre-test idle strip (regression)', () => {
  beforeEach(resetHarness);

  it('opens pre-test: no row claims Success from the seeded status', async () => {
    renderStep();

    // Row1 (host 10.20.30.40) carries a seeded connection_status; step 5 is pre-test, so
    // nothing may read Success until a run settles. 연결 상태 칸은 실행이 보고한 것만
    // 읽으므로(시드값이 아니라) 여기서는 무보고 '—' 다 — 아래 '연결 상태 열' 참고.
    await screen.findByText('10.20.30.40');
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('reads the stored credential in the row and opens the picker on it', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // 값은 행에서 읽는다 — 무엇이 걸려 있는지 보려고 모달을 열 필요가 없다.
    const trigger = screen.getByRole('button', { name: /10\.20\.30\.40 Credential 수정 — 현재 idc_svc_mysql/ });
    fireEvent.click(trigger);
    // 대상은 IDC 가 부르는 이름(접속 주소)으로 적힌다 — ARN 을 쓰는 클라우드와 라벨이 다르다.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('접속 주소')).toBeTruthy();
    expect(within(dialog).getByText('10.20.30.40:3306')).toBeTruthy();
  });

  it('shows the idle summary card (nothing connected yet)', async () => {
    renderStep();

    expect(
      await screen.findByText('아직 실행한 연결 테스트가 없습니다'),
    ).toBeTruthy();
    // No run yet: the summary carries no run meta and no % (pct only renders while
    // a run is in flight — an idle screen has nothing to be a percentage OF).
    expect(screen.queryByText(/^실행 #/)).toBeNull();
  });

  it('blocks Run Test while a live row lacks a credential, and says so above the table', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    // Row2 has no credential. The warning line names the count and the row's own cell is
    // where it gets fixed — Run Test does not detour through a bulk dialog.
    expect((await screen.findByText(/Credential 미설정/)).textContent).toContain('1건');
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '미설정만 보기' })).toBeTruthy();
  });
});

const agentResult = (resource_id: string, connection_status: TestConnectionStatus) => ({
  agent_id: `agent-${resource_id}`,
  gcp_region: '',
  resource_id,
  connection_status,
  database_uri_list: [] as string[],
});

const makeJob = (
  connection_status: TestConnectionStatus,
  agents: ReturnType<typeof agentResult>[],
): TestConnectionVersionResult => ({
  target_source_id: 1020,
  test_connection_version: 3,
  connection_status,
  requested_at: '2026-01-25T14:00:00Z',
  completed_at: '2026-01-25T14:01:00Z',
  test_connection_agent_results: agents,
});

// The IDC card shares foldTcCardState with the cloud sibling, but carries one gate the
// cloud card does not (credsDirty) — the slot states need their own coverage here.
describe('IdcStep5ConnectionTest — state-driven slot (시안 A)', () => {
  beforeEach(resetHarness);

  it('shows Fail with 다시 실행 as the only CTA — no 완료 승인 요청', async () => {
    pollingState.uiState = 'FAIL';
    pollingState.latestJob = makeJob('FAIL', [
      agentResult('idc-row-0', 'FAIL'),
      agentResult('idc-row-1', 'FAIL'),
    ]);
    renderStep();

    // 판정은 문장이, 개수(실패 2)는 그 아래 카운트 줄이 나른다.
    expect(await screen.findByText('연결에 실패한 리소스가 있어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy();
  });

  it('folds a policy change into the pending card state with 다시 실행 as the only CTA', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({
      test_connection_status: 'LOGICAL_DATABASE_RECENTLY_UPDATED',
      logical_database_updated_at: '2026-01-25T15:22:00Z',
    });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [
      agentResult('idc-row-0', 'SUCCESS'),
      agentResult('idc-row-1', 'SUCCESS'),
    ]);
    renderStep();

    expect(await screen.findByText('논리 DB 정책이 마지막 실행 이후 변경됐어요')).toBeTruthy();
    expect(screen.getByText('연결 테스트를 다시 수행해야 합니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy();
  });

  it('seals the card on CONFIRMED — no CTA at all, history stays reachable', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({ test_connection_status: 'CONFIRMED' });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [
      agentResult('idc-row-0', 'SUCCESS'),
      agentResult('idc-row-1', 'SUCCESS'),
    ]);
    renderStep();

    expect(await screen.findByText('연결 테스트 완료 확인됨')).toBeTruthy();
    expect(screen.getByText('최근 수행 결과 기준')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.queryByRole('button', { name: /다시 실행/ })).toBeNull();
    expect(screen.getByRole('button', { name: '실행 이력' })).toBeTruthy();
  });

  // The IDC-only gate: a credential edited AFTER the run is unverified — the open
  // completion verdict belongs to the old credential, so 승인 stays closed until a re-run.
  it('closes 완료 승인 요청 when a credential changes after the run (credsDirty)', async () => {
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [
      agentResult('idc-row-0', 'SUCCESS'),
      agentResult('idc-row-1', 'SUCCESS'),
    ]);
    renderStep();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', false),
    );

    // Edit row1's credential through the picker — the PUT succeeds.
    fireEvent.click(screen.getByRole('button', { name: /10\.20\.30\.40 Credential 수정/ }));
    await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Key2' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    expect(updateResourceCredentialMock).toHaveBeenCalledWith(1020, 'idc-row-0', 'Key2');

    expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', true);
  });
});

/**
 * 연결 상태 열 — 클라우드 step 5 가 이미 가지고 있던 칸을 IDC 표에도 세운다.
 * 스트립의 카운트는 실행 전체를 말하지, **어느 대상이** 실패했는지는 말하지 못한다.
 */
describe('IdcStep5ConnectionTest — 연결 상태 열', () => {
  beforeEach(resetHarness);

  /**
   * 그 행의 연결 상태 칸. **자리로 집는다** — 행에는 '—'를 찍을 수 있는 칸이 여럿이라
   * (논리 DB 카운트) 글자로 찾으면 어느 칸을 읽었는지 알 수 없다. 5번째 열이라는 것
   * 자체가 계약이다: 접속 주소 · Port · Database Type · Credential · **연결 상태** ·
   * 연동 논리 DB · 연동 제외 · 출발지 (클라우드 step 5 의 순서).
   */
  const connCell = (host: string): HTMLElement => {
    const row = screen.getByText(host).closest('tr');
    if (!row) throw new Error(`row not found: ${host}`);
    const cell = row.querySelectorAll('td')[4];
    if (!cell) throw new Error(`연결 상태 cell not found: ${host}`);
    return cell as HTMLElement;
  };

  it('행마다 그 리소스의 판정을 적는다 — 보고가 없는 행은 대기가 아니라 —', async () => {
    pollingState.uiState = 'FAIL';
    // row1(10.20.31.10)은 결과가 오지 않았다: '대기'로 접으면 agent 가 PENDING 을 보고한
    // 행과 구분되지 않는다.
    pollingState.latestJob = makeJob('FAIL', [agentResult('idc-row-0', 'FAIL')]);
    renderStep();

    await screen.findByText('10.20.30.40');
    expect(screen.getByText('연결 상태')).toBeTruthy();
    expect(connCell('10.20.30.40').textContent).toBe('실패');
    expect(connCell('10.20.31.10').textContent).toBe('—');
  });

  it('성공한 행만 성공이라고 말한다', async () => {
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [
      agentResult('idc-row-0', 'SUCCESS'),
      agentResult('idc-row-1', 'PENDING'),
    ]);
    renderStep();

    await screen.findByText('10.20.30.40');
    expect(connCell('10.20.30.40').textContent).toBe('성공');
    expect(connCell('10.20.31.10').textContent).toBe('대기');
  });

  it('첫 폴링이 끝나기 전에는 판정 대신 스켈레톤이다', async () => {
    pollingState.loading = true;
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('idc-row-0', 'SUCCESS')]);
    renderStep();

    await screen.findByText('10.20.30.40');
    // 아직 모르는 값을 판정처럼 찍지 않는다 — 성공도, 무보고 대시도 아니다.
    expect(connCell('10.20.30.40').textContent).toBe('');
    expect(connCell('10.20.30.40').querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('실행 전에는 어느 행도 판정을 말하지 않는다', async () => {
    renderStep();

    await screen.findByText('10.20.30.40');
    expect(screen.queryByText('성공')).toBeNull();
    expect(screen.queryByText('실패')).toBeNull();
  });
});
