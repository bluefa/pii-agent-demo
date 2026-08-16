// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import type {
  TestConnectionVersionResult,
  TestConnectionStatus,
} from '@/app/lib/api';
import type {
  TestConnectionUIState,
  UseTestConnectionPollingReturn,
} from '@/app/hooks/useTestConnectionPolling';

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader',
  () => ({ LogicalDbModalLoader: () => null }),
);

// CloudReqApprovalModal imports the api; stub it so this test focuses on the card's
// gating + the "open approval" intent (the modal's own PUT is covered separately).
const approvalModalProps = vi.fn();
vi.mock('@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal', () => ({
  CloudReqApprovalModal: (props: { isOpen: boolean }) => {
    approvalModalProps(props);
    return props.isOpen ? <div data-testid="approval-modal" /> : null;
  },
}));

// 폴링은 이제 step 이 소유하고 카드는 prop 으로 받는다 — 모듈 mock 대신 renderCard 가
// pollingState 로 번들을 만들어 넘긴다.
const triggerMock = vi.fn(async () => true);
const pollingState: {
  uiState: TestConnectionUIState;
  latestJob: TestConnectionVersionResult | null;
  /** 첫 latest_version 응답 전 — 그 동안 연결 상태 칸도 요약 스트립도 판정을 말하지 않는다. */
  loading: boolean;
  /** 실행 시작 요청이 떠 있는 동안 — 버튼 라벨이 '진행 중'으로 바뀌는 근거. */
  triggering: boolean;
  /** 실행을 시작해도 되는가 — 화면이 보는 단일 사실. */
  canRunTest: boolean;
} = { uiState: 'IDLE', latestJob: null, loading: false, triggering: false, canRunTest: true };

const makePolling = (): UseTestConnectionPollingReturn => ({
  latestJob: pollingState.latestJob,
  uiState: pollingState.uiState,
  loading: pollingState.loading,
  triggering: pollingState.triggering,
  canRunTest: pollingState.canRunTest,
  retry: async () => {},
  fetchError: null,
  triggerError: null,
  trigger: triggerMock,
});

const updateResourceCredentialMock = vi.fn();
const getSecretsMock = vi.fn(async (..._args: unknown[]) => [{ name: 'Key1' }, { name: 'Key2' }, { name: 'Key3' }]);
// completion-status now gates 완료 승인 요청 (useTcCompletionStatus) — default to the
// open verdict so the B2/B3 gate tests keep exercising the poll transition itself.
const getCompletionStatusMock = vi.fn(
  async (
    ..._args: unknown[]
  ): Promise<{ test_connection_status: string; logical_database_updated_at?: string }> => ({
    test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS',
  }),
);
vi.mock('@/app/lib/api', () => ({
  updateResourceCredential: (...args: unknown[]) => updateResourceCredentialMock(...args),
  getSecrets: (...args: unknown[]) => getSecretsMock(...args),
  getTestConnectionCompletionStatus: (...args: unknown[]) => getCompletionStatusMock(...args),
}));
// The rejection notice + run-history modal fetch on their own — quiet, empty defaults.
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => ({ status: 'TEST_CONNECTION_COMPLETED', rejectReason: null, rejectedAt: null })),
  getTestConnectionExecutionHistory: vi.fn(async () => ({ totalElements: 0, totalPages: 1, content: [] })),
}));

import { ConnectionTestCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard';

const makeResource = (overrides: Partial<ConfirmedResource> = {}): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  resourceName: 'space-prod',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'Key1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

const agentResult = (
  resource_id: string,
  connection_status: TestConnectionStatus,
) => ({
  agent_id: `agent-${resource_id}`,
  gcp_region: 'ap-northeast-2',
  resource_id,
  connection_status,
  database_uri_list: [],
});

const makeJob = (
  connection_status: TestConnectionStatus,
  agents: ReturnType<typeof agentResult>[],
): TestConnectionVersionResult => ({
  target_source_id: 1,
  test_connection_version: 1,
  connection_status,
  requested_at: '2026-01-25T14:00:00Z',
  completed_at: connection_status === 'PENDING' ? '' : '2026-01-25T14:01:00Z',
  test_connection_agent_results: agents,
});

const renderCard = (confirmed: ConfirmedResource[]) =>
  render(
    <ConnectionTestCard
      targetSourceId={1}
      confirmed={confirmed}
      providerLabel="Azure Infrastructure"
      refreshProject={() => {}}
      polling={makePolling()}
    />,
  );

describe('ConnectionTestCard', () => {
  beforeEach(() => {
    pollingState.uiState = 'IDLE';
    pollingState.latestJob = null;
    pollingState.loading = false;
    pollingState.triggering = false;
    pollingState.canRunTest = true;
    triggerMock.mockReset();
    triggerMock.mockResolvedValue(true);
    updateResourceCredentialMock.mockReset();
    updateResourceCredentialMock.mockResolvedValue({ success: true });
    approvalModalProps.mockClear();
  });

  // ORDER is the assertion, not just presence: this table shows the same resources steps
  // 1·2·3 just showed, so it opens on the same anchor (name → attributes → what this step
  // asks). Resource ID is the one column those steps carry that this one drops — seven
  // columns at the approval gutters overflow the card, and it is the only one nothing here
  // is decided by.
  it('reads in the steps 1·2·3 column order, without their Resource ID', () => {
    renderCard([makeResource()]);
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Resource Name',
      'Database Type',
      'Region',
      'Credential',
      '연결 상태',
      '논리 DB 확인',
    ]);
  });

  it('opens every credentialed row unreported (—), not a claimed 대기 (step5 is pre-test)', () => {
    renderCard([makeResource({ credentialId: 'Key1' })]);
    // No agent has reported: the cell says nothing ('—') instead of folding the
    // absence into 대기 — 대기 is reserved for an agent-reported PENDING. (The summary
    // count labels also read 성공/대기, so the row assertion scopes to the table.)
    const table = within(screen.getByRole('table'));
    expect(table.queryByText('대기')).toBeNull();
    expect(table.queryByText('성공')).toBeNull();
  });

  // 확정 목록(confirmed-integration)이 latest_version 보다 먼저 도착하면 표는 폴링 결과 없이
  // 한 번 그려진다 — 그 사이 찍히던 '—'/'대기'는 판정처럼 읽혔고, 응답이 오면 곧바로 성공으로
  // 뒤집혀 같은 칸을 두 번 읽게 만들었다. 모르는 동안에는 스켈레톤만 있어야 한다.
  it('draws a skeleton in 연결 상태 while the first latest_version is still in flight', () => {
    pollingState.loading = true;
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const table = screen.getByRole('table');
    expect(table.getAttribute('aria-busy')).toBe('true');
    // 결과가 이미 손에 있어도 로딩 중이면 말하지 않는다 — 게이트는 latestJob 이 아니라 loading.
    expect(within(table).queryByText('성공')).toBeNull();
    expect(within(table).queryByText('대기')).toBeNull();
    expect(within(table).queryByText('—')).toBeNull();
    expect(table.querySelectorAll('tbody .animate-pulse').length).toBe(1);
  });

  /**
   * 표의 칸만 고치고 그 위 요약 스트립을 두면, 더 먼저 읽히는 표면이 여전히 판정을 말한다:
   * "연결 테스트 대기 중 — Run Test를 실행해 주세요 / 성공 0 · 미보고 1" 이 떴다가 응답이
   * 오면 "모두 성공"으로 뒤집힌다. 같은 게이트를 두 표면이 함께 써야 고친 것이 된다.
   */
  it('does not let the summary strip claim a phase while the first poll is in flight', () => {
    pollingState.loading = true;
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(screen.queryByText(/Run Test를 실행해 주세요/)).toBeNull();
    expect(screen.queryByText(/모두 연결에 성공했어요/)).toBeNull();
    expect(screen.queryByText('미보고')).toBeNull();
    expect(document.querySelector('[aria-busy="true"] .animate-pulse')).toBeTruthy();
  });

  /**
   * 첫 latest_version 전에는 `testing` 이 false 지만, 그것은 "돌고 있지 않다"가 아니라
   * "아직 모른다"이다. 슬롯 CTA 는 스트립 안에 사니, 스트립이 스켈레톤인 동안은 버튼
   * 자체가 없다 — 존재하지 않는 버튼은 눌리지도 않고, "진행 중" 주장도 없다.
   */
  it('locks Run Test until the first latest_version answers, without claiming a run is under way', () => {
    pollingState.loading = true;
    pollingState.canRunTest = false;
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(screen.queryByRole('button', { name: /Run Test/ })).toBeNull();
    expect(document.querySelector('[aria-busy="true"] .animate-pulse')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /진행 중/ })).toBeNull();
  });

  /**
   * `testing` 은 latest_version 이 새 실행을 되돌려준 뒤에야 켜진다. 그 왕복 동안 버튼이
   * 살아 있으면 두 번째 클릭이 409 를 받아, 사용자가 부른 적 없는 오류 줄이 뜬다.
   * 라벨은 여전히 Run Test — 실제로 도는 것을 본 적이 없는데 "진행 중"이라고 적는 것
   * 역시 하지 않은 판단이라, 그 구간의 슬롯은 Run Test 인 채로 비활성만 된다.
   */
  it('locks Run Test while the trigger request is still in flight', () => {
    pollingState.triggering = true;
    pollingState.canRunTest = false;
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const button = screen.getByRole('button', { name: /Run Test/ });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: /진행 중/ })).toBeNull();
  });

  it('replaces the skeleton with the verdict once the poll lands', () => {
    pollingState.loading = false;
    pollingState.triggering = false;
    pollingState.canRunTest = true;
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const table = screen.getByRole('table');
    expect(table.getAttribute('aria-busy')).toBe('false');
    expect(table.querySelectorAll('tbody .animate-pulse').length).toBe(0);
    expect(within(table).getByText('성공')).toBeTruthy();
  });

  it('disables Run Test when a row has no credential, without touching Connection Status', () => {
    renderCard([makeResource({ credentialId: null })]);
    // Connection Status only ever says what the agent reported — nothing ran, so no verdict.
    expect(within(screen.getByRole('table')).queryByText('성공')).toBeNull();
    expect(screen.queryByText('자격 증명 필요')).toBeNull();
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '설정' })).toHaveProperty('disabled', true);
  });

  it('enables Run Test when every row has a credential selected', () => {
    renderCard([makeResource({ credentialId: 'Key1' }), makeResource({ resourceId: 'res-2', credentialId: 'Key2' })]);
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', false);
  });

  it('does not require a credential for engines that connect without one (Athena)', () => {
    renderCard([
      makeResource({ resourceId: 'athena-1', databaseType: 'athena', credentialId: null }),
    ]);
    expect(screen.getByText('불필요')).toBeTruthy();
    expect(screen.queryByText('자격 증명 필요')).toBeNull();
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', false);
  });

  // 판정이 mysql·postgresql·redshift 허용 목록이던 동안 이 엔진들은 "불필요"로 찍혔다 —
  // 실제로는 계정이 있어야 붙고, IDC step 5 는 같은 엔진에 이미 요구하고 있었다.
  it.each(['mssql', 'oracle', 'mongodb', 'mariadb'])(
    'requires a credential for %s, and blocks Run Test until one is set',
    (databaseType) => {
      renderCard([makeResource({ resourceId: `${databaseType}-1`, databaseType, credentialId: null })]);
      expect(screen.queryByText('불필요')).toBeNull();
      expect(screen.getByRole('button', { name: /Credential 수정 — 현재 미설정/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    },
  );

  it('counts Credential-free engines as neither, and the warning line filters the table', () => {
    // The table names rows by Resource Name (Resource ID is not a column here).
    renderCard([
      makeResource({ resourceId: 'res-1', resourceName: 'named-cred', credentialId: 'Key1' }),
      makeResource({ resourceId: 'res-2', resourceName: 'named-missing', credentialId: null }),
      makeResource({
        resourceId: 'athena-1',
        resourceName: 'named-athena',
        databaseType: 'athena',
        credentialId: null,
      }),
      makeResource({
        resourceId: 'dynamo-1',
        resourceName: 'named-dynamo',
        databaseType: 'dynamodb',
        credentialId: null,
      }),
    ]);
    // Athena / DynamoDB are not counted — only the credential-requiring res-2 is missing one.
    expect(screen.getByText(/Credential 미설정/).textContent).toContain('1건');

    fireEvent.click(screen.getByRole('button', { name: '미설정만 보기' }));
    expect(screen.getByText('named-missing')).toBeTruthy();
    expect(screen.queryByText('named-athena')).toBeNull();
    expect(screen.queryByText('named-cred')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByText('named-athena')).toBeTruthy();
  });

  // 0 미등록은 정상 상태다 — 그때 경고 줄이 남아 있으면 "할 일 없음"을 상시로 말하게 된다.
  it('draws no warning line when every credential-requiring row has one', () => {
    renderCard([
      makeResource({ resourceId: 'res-1', resourceName: 'named-cred', credentialId: 'Key1' }),
      makeResource({
        resourceId: 'athena-1',
        resourceName: 'named-athena',
        databaseType: 'athena',
        credentialId: null,
      }),
    ]);
    expect(screen.queryByText(/Credential 미설정/)).toBeNull();
    expect(screen.queryByRole('button', { name: '미설정만 보기' })).toBeNull();
  });

  // Regression: a healthy target used to read 대기 / 0% purely because no credential was
  // picked locally, so a fully passed run showed "성공 0 · 대기 1 · 0%". The strip counts
  // the reported result; the credential gates Run Test, not the verdict.
  it('reports a SUCCESS unit as connected even with no credential selected', () => {
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ resourceId: 'res-1', credentialId: null })]);
    // Row tag and the summary count both say 성공; the sentence states the fact.
    expect(screen.getAllByText('성공').length).toBeGreaterThan(0);
    expect(screen.getByText(/리소스 1개 모두 연결에 성공했어요/)).toBeTruthy();
  });

  it('Run Test triggers the async test (no local credential change → no credential PUT)', async () => {
    renderCard([makeResource({ credentialId: 'Key1' })]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
    });
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(updateResourceCredentialMock).not.toHaveBeenCalled();
  });

  // The cell reads the assignment and opens the picker; the write happens on 저장 there,
  // so nothing is committed by merely looking at the options.
  const openCredModal = async (currentLabel: string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Credential 수정 — 현재 ${currentLabel}`) }));
    });
    // Wait for the secrets-backed options to load so 'Key2' is pickable.
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Key2' })).toBeTruthy());
  };

  it('writes the credential on 저장 in the picker, not on opening it', async () => {
    renderCard([makeResource({ resourceId: 'res-9', credentialId: 'Key1' })]);
    await openCredModal('Key1');
    expect(updateResourceCredentialMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Key2' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    expect(updateResourceCredentialMock).toHaveBeenCalledWith(1, 'res-9', 'Key2');

    // Run Test then triggers the test without a second PUT.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
    });
    expect(updateResourceCredentialMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  it('does not update local credential state when the PUT fails', async () => {
    updateResourceCredentialMock.mockRejectedValueOnce(new Error('서버 오류'));
    renderCard([makeResource({ resourceId: 'res-9', credentialId: 'Key1' })]);
    await openCredModal('Key1');
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Key2' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    // Local state did not flip — the cell still reads Key1.
    expect(
      screen.getByRole('button', { name: /Credential 수정 — 현재 Key1/ }),
    ).toBeTruthy();
  });

  it('renders Credential-free engines as plain text, with nothing to edit', () => {
    renderCard([
      makeResource({ resourceId: 'athena-1', databaseType: 'athena', credentialId: null }),
    ]);
    expect(screen.getByText('불필요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Credential 수정/ })).toBeNull();
  });

  // The card re-seeds local credential state whenever the `confirmed` reference
  // changes, so a poll-driven re-render must keep the SAME array instance (in
  // production it comes from the stable confirmed-integration context). A fresh
  // element is built each rerender (an identical element instance makes React
  // bail out) while the array reference stays stable.
  const renderStable = (confirmed: ConfirmedResource[]) => {
    // makePolling() runs per element build, so a rerender picks up the mutated
    // pollingState — the same observation semantics the step's live hook has.
    const element = () => (
      <ConnectionTestCard
        targetSourceId={1}
        confirmed={confirmed}
        providerLabel="Azure Infrastructure"
        refreshProject={() => {}}
        polling={makePolling()}
      />
    );
    const { rerender } = render(element());
    return () => rerender(element());
  };

  it('hydrates row statuses from latest_version on mount without Run Test click (B3)', async () => {
    // Simulate a prior SUCCESS result already in the mock on cold load.
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    renderCard(confirmed);
    // Row must show Success and CTA must be enabled — no Run Test click.
    expect((await screen.findAllByText('성공')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', false),
    );
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('enables 완료 승인 요청 when latest_version.connectionStatus is SUCCESS (B2)', async () => {
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    const rerender = renderStable(confirmed);

    // Poll settles SUCCESS after Run Test — approval gate reads uiState directly.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
    });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    act(() => rerender());

    expect((await screen.findAllByText('성공')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', false),
    );
  });

  it('shows Fail and keeps 완료 승인 요청 disabled when latest_version.connectionStatus is FAIL', async () => {
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    const rerender = renderStable(confirmed);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
    });
    pollingState.uiState = 'FAIL';
    pollingState.latestJob = makeJob('FAIL', [agentResult('res-1', 'FAIL')]);
    act(() => rerender());
    expect(await screen.findByText('실패')).toBeTruthy();
    // FAIL 의 정답 행동은 재실행 하나다 — 승인 CTA 는 비활성이 아니라 슬롯에서 아예 빠진다.
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy();
  });

  // 시안 A: SUCCESS 정착이라도 completion 판정이 카드 상태를 가른다 — 정책 변경은
  // pending 표면 + 재실행 CTA 하나, CONFIRMED 는 봉인(CTA 없음, 이력만).
  it('folds a policy change into the pending card state with 다시 실행 as the only CTA', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({
      test_connection_status: 'LOGICAL_DATABASE_RECENTLY_UPDATED',
      logical_database_updated_at: '2026-01-25T15:22:00Z',
    });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(await screen.findByText('논리 DB 정책이 마지막 실행 이후 변경됐어요')).toBeTruthy();
    // 계약의 시각 두 개가 "실행이 뒤처짐"을 구체화한다.
    expect(screen.getByText(/정책 변경 .* · 마지막 실행 /)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy();
  });

  it('seals the card on CONFIRMED — no CTA at all, history stays reachable', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({ test_connection_status: 'CONFIRMED' });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(await screen.findByText('연결 테스트 완료 확인됨')).toBeTruthy();
    expect(screen.getByText('실행 #1 결과 기준')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '완료 승인 요청' })).toBeNull();
    expect(screen.queryByRole('button', { name: /다시 실행/ })).toBeNull();
    expect(screen.getByRole('button', { name: '실행 이력' })).toBeTruthy();
  });

  // Step 5 has its own table (not WaitingApprovalTable), so the cluster tag had to be added
  // here separately — the type comes from the confirmed row, never from the engine.
  describe('RDS cluster tag', () => {
    it('tags a cluster row above its name, keeping the engine in the type column', () => {
      renderCard([
        makeResource({ type: 'AWS_DB_CLUSTER', resourceName: 'demo-cluster', credentialId: 'Key1' }),
      ]);
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
      expect(screen.getByText('demo-cluster')).toBeTruthy();
    });

    it('leaves a single-instance row untagged', () => {
      renderCard([makeResource({ type: 'AWS_DB_INSTANCE', credentialId: 'Key1' })]);
      expect(screen.queryByText('RDS Cluster')).toBeNull();
    });
  });
});
