// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader',
  () => ({ LogicalDbModalLoader: () => null }),
);

// CloudReqApprovalModal imports the api; stub it so this test focuses on the card's
// gating + the "open approval" intent (the modal's own PUT is covered separately).
const approvalModalProps = vi.fn();
vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal', () => ({
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
vi.mock('@/app/lib/api', () => ({
  updateResourceCredential: (...args: unknown[]) => updateResourceCredentialMock(...args),
  getSecrets: (...args: unknown[]) => getSecretsMock(...args),
}));

import { ConnectionTestCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard';

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

  it('renders the 7 v16 connection-test columns', () => {
    renderCard([makeResource()]);
    for (const header of [
      'Database Type',
      'Resource ID',
      'Region',
      'Resource Name',
      'DB Credential',
      'Connection Status',
      '논리 DB 확인',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
  });

  it('opens every credentialed row as Pending (step5 is pre-test)', () => {
    renderCard([makeResource({ credentialId: 'Key1' })]);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('shows 자격 증명 필요 and disables Run Test + 설정 when a row has no credential', () => {
    renderCard([makeResource({ credentialId: null })]);
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '설정' })).toHaveProperty('disabled', true);
  });

  it('enables Run Test when every row has a credential selected', () => {
    renderCard([makeResource({ credentialId: 'Key1' }), makeResource({ resourceId: 'res-2', credentialId: 'Key2' })]);
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', false);
  });

  it('Run Test triggers the async test (no local credential change → no credential PUT)', async () => {
    renderCard([makeResource({ credentialId: 'Key1' })]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
    });
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(updateResourceCredentialMock).not.toHaveBeenCalled();
  });

  it('fires updateResourceCredential immediately on credential selection, before Run Test', async () => {
    renderCard([makeResource({ resourceId: 'res-9', credentialId: 'Key1' })]);
    // Wait for the secrets-backed options to load so 'Key2' is selectable.
    await waitFor(() => expect(screen.getByRole('option', { name: 'Key2' })).toBeTruthy());
    // The PUT fires on the change event itself, not on Run Test click.
    await act(async () => {
      fireEvent.change(screen.getByLabelText('DB Credential 선택'), { target: { value: 'Key2' } });
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
    await act(async () => {
      fireEvent.change(screen.getByLabelText('DB Credential 선택'), { target: { value: 'Key2' } });
    });
    // Local state did not flip — row still shows Pending (cred still seeded as Key1).
    expect(screen.getByText('Pending')).toBeTruthy();
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
    expect(await screen.findByText('Success')).toBeTruthy();
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

    expect(await screen.findByText('Success')).toBeTruthy();
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
    expect(await screen.findByText('Fail')).toBeTruthy();
    expect(screen.getByRole('button', { name: '완료 승인 요청' })).toHaveProperty('disabled', true);
  });
});
