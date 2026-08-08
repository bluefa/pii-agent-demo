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

const triggerMock = vi.fn();
const pollingState: {
  uiState: TestConnectionUIState;
  latestJob: TestConnectionVersionResult | null;
} = { uiState: 'IDLE', latestJob: null };

vi.mock('@/app/hooks/useTestConnectionPolling', () => ({
  // useTcSettleHold (실제 구현이 돈다) 가 정착 판정에 쓴다.
  isInProgress: (status: string) => status === 'PENDING' || status === 'RUNNING',
  useTestConnectionPolling: (): UseTestConnectionPollingReturn => ({
    latestJob: pollingState.latestJob,
    uiState: pollingState.uiState,
    loading: false,
    fetchError: null,
    triggerError: null,
    trigger: triggerMock,
  }),
}));

const updateResourceCredentialMock = vi.fn();
const getSecretsMock = vi.fn(async (..._args: unknown[]) => [{ name: 'Key1' }, { name: 'Key2' }, { name: 'Key3' }]);
// completion-status now gates 완료 승인 요청 (useTcCompletionStatus) — default to the
// open verdict so the B2/B3 gate tests keep exercising the poll transition itself.
const getCompletionStatusMock = vi.fn(async (..._args: unknown[]) => ({
  test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS',
}));
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
    />,
  );

describe('ConnectionTestCard', () => {
  beforeEach(() => {
    pollingState.uiState = 'IDLE';
    pollingState.latestJob = null;
    triggerMock.mockReset();
    triggerMock.mockResolvedValue(undefined);
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
    const element = () => (
      <ConnectionTestCard
        targetSourceId={1}
        confirmed={confirmed}
        providerLabel="Azure Infrastructure"
        refreshProject={() => {}}
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
    expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', true);
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
