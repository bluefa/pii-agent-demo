// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import { AppError } from '@/lib/errors';
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
  fetchError: AppError | null;
} = {
  uiState: 'IDLE',
  latestJob: null,
  loading: false,
  triggering: false,
  canRunTest: true,
  fetchError: null,
};

const makePolling = (): UseTestConnectionPollingReturn => ({
  latestJob: pollingState.latestJob,
  uiState: pollingState.uiState,
  loading: pollingState.loading,
  triggering: pollingState.triggering,
  canRunTest: pollingState.canRunTest,
  retry: async () => {},
  fetchError: pollingState.fetchError,
  triggerError: null,
  trigger: triggerMock,
});

const updateResourceCredentialMock = vi.fn();
const getSecretsMock = vi.fn(async (..._args: unknown[]) => [{ name: 'Key1' }, { name: 'Key2' }, { name: 'Key3' }]);
// completion-status now gates 승인 요청 (useTcCompletionStatus) — default to the
// open verdict so the B2/B3 gate tests keep exercising the poll transition itself.
const getCompletionStatusMock = vi.fn(
  async (
    ..._args: unknown[]
  ): Promise<{ test_connection_status: string; logical_database_updated_at?: string }> => ({
    test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS',
  }),
);
// 표의 `연동 논리 DB` 그룹이 읽는 리소스별 건수. 기본은 빈 목록 — 어느 유닛도 보고되지
// 않았으므로 두 수는 0 이 아니라 `—` 다.
const getSummariesMock = vi.fn(
  async (..._args: unknown[]): Promise<Record<string, unknown>[]> => [],
);
vi.mock('@/app/lib/api', () => ({
  updateResourceCredential: (...args: unknown[]) => updateResourceCredentialMock(...args),
  getSecrets: (...args: unknown[]) => getSecretsMock(...args),
  getTestConnectionCompletionStatus: (...args: unknown[]) => getCompletionStatusMock(...args),
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
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
    pollingState.fetchError = null;
    triggerMock.mockReset();
    triggerMock.mockResolvedValue(true);
    updateResourceCredentialMock.mockReset();
    updateResourceCredentialMock.mockResolvedValue({ success: true });
    // mockClear would leave queued mockResolvedValueOnce verdicts to leak into the
    // next test — reset drains the queue, then restore the default open verdict.
    getCompletionStatusMock.mockReset();
    getCompletionStatusMock.mockResolvedValue({ test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS' });
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue([]);
    approvalModalProps.mockClear();
  });

  // ORDER is the assertion, not just presence: this table shows the same resources steps
  // 1·2·3 just showed, so it opens on the same anchor (identity pair → attributes → what
  // this step asks). Resource ID sits second, where every other resource table puts it —
  // it was dropped here on a width argument and restored by the owner (2026-08-27).
  it('reads in the steps 1·2·3 column order, Resource ID included', () => {
    renderCard([makeResource()]);
    // 두 단 머리 — 위 줄은 그룹이 자기 세 잎을 삼키고, 잎은 아래 줄에 선다.
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Resource Name',
      'Resource ID',
      'Database Type',
      'Region',
      'Credential',
      '연결 상태',
      '연동 논리 DB',
      '대상',
      '제외',
      '관리',
    ]);
  });

  it('opens every credentialed row 미실행, not a claimed 대기 (step5 is pre-test)', () => {
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
  /**
   * 조회를 못 한 것과 회차가 없는 것은 정반대의 답을 요구한다. 첫 조회가 실패하면 latestJob 은
   * null 인 채 loading 도 꺼지므로(무한 스피너를 피하려고), `!!latestJob` 만 보면 표 전체가
   * '미실행' 이라고 **단정**한다 — 실패는 빈 결과가 아니다.
   */
  it('never claims 미실행 when the fetch is what failed', () => {
    pollingState.fetchError = new AppError({
      status: 503,
      code: 'INTERNAL_ERROR',
      message: '503',
      retriable: true,
    });
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const table = screen.getByRole('table');
    expect(within(table).getByText('조회 실패')).toBeTruthy();
    expect(within(table).queryByText('미실행')).toBeNull();
  });

  /**
   * 반대쪽 경계. 폴이 한 번이라도 성공했으면 usePollingBase 는 에러가 나도 그 스냅샷을 비우지
   * 않는다. 스냅샷이 손에 있으면 '읽지 못했다'가 아니라 '그 회차가 이 행을 언급하지 않았다'가
   * 참이고, 카드 카운트 줄도 같은 순간 그 행을 미보고로 센다 — 표만 다른 말을 하면 한 화면이
   * 두 말을 한다.
   */
  it('keeps saying 미보고 when a refresh blips but the snapshot is still in hand', () => {
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    pollingState.fetchError = new AppError({
      status: 503,
      code: 'INTERNAL_ERROR',
      message: '503',
      retriable: true,
    });
    renderCard([makeResource({ credentialId: 'Key1' }), makeResource({ resourceId: 'res-2', credentialId: 'Key1' })]);

    const table = screen.getByRole('table');
    expect(within(table).getByText('성공')).toBeTruthy();
    expect(within(table).getByText('미보고')).toBeTruthy();
    expect(within(table).queryByText('조회 실패')).toBeNull();
  });

  it('draws a skeleton in 연결 상태 while the first latest_version is still in flight', () => {
    pollingState.loading = true;
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const table = screen.getByRole('table');
    expect(table.getAttribute('aria-busy')).toBe('true');
    // 결과가 이미 손에 있어도 로딩 중이면 말하지 않는다 — 게이트는 latestJob 이 아니라 loading.
    expect(within(table).queryByText('성공')).toBeNull();
    expect(within(table).queryByText('대기')).toBeNull();
    // 판정 없음을 말하는 두 태그도 아직 서면 안 된다 — 모르는 동안은 스켈레톤뿐이다.
    expect(within(table).queryByText('미보고')).toBeNull();
    expect(within(table).queryByText('미실행')).toBeNull();
    expect(table.querySelectorAll('tbody .animate-pulse').length).toBe(1);
  });

  /**
   * 표의 칸만 고치고 그 위 요약 스트립을 두면, 더 먼저 읽히는 표면이 여전히 판정을 말한다:
   * "아직 실행한 연결 테스트가 없습니다 / 대상 리소스 1개" 가 떴다가 응답이 오면
   * "모두 성공"으로 뒤집힌다. 같은 게이트를 두 표면이 함께 써야 고친 것이 된다.
   */
  it('does not let the summary strip claim a phase while the first poll is in flight', () => {
    pollingState.loading = true;
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(screen.queryByText(/연결 테스트를 실행해 주세요/)).toBeNull();
    expect(screen.queryByText(/연결에 성공했어요/)).toBeNull();
    expect(screen.queryByText('미보고')).toBeNull();
    expect(document.querySelector('[aria-busy="true"] .animate-pulse')).toBeTruthy();
  });

  /**
   * 첫 latest_version 전에는 `testing` 이 false 지만, 그것은 "돌고 있지 않다"가 아니라
   * "아직 모른다"이다. 슬롯 CTA 는 스트립 안에 사니, 스트립이 스켈레톤인 동안은 버튼
   * 자체가 없다 — 존재하지 않는 버튼은 눌리지도 않고, "진행 중" 주장도 없다.
   */
  it('locks the run CTA until the first latest_version answers, without claiming a run is under way', () => {
    pollingState.loading = true;
    pollingState.canRunTest = false;
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(screen.queryByRole('button', { name: '실행' })).toBeNull();
    expect(document.querySelector('[aria-busy="true"] .animate-pulse')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /진행 중/ })).toBeNull();
  });

  /**
   * `testing` 은 latest_version 이 새 실행을 되돌려준 뒤에야 켜진다. 그 왕복 동안 버튼이
   * 살아 있으면 두 번째 클릭이 409 를 받아, 사용자가 부른 적 없는 오류 줄이 뜬다.
   * 라벨은 여전히 실행 — 실제로 도는 것을 본 적이 없는데 "진행 중"이라고 적는 것
   * 역시 하지 않은 판단이라, 그 구간의 슬롯은 실행 인 채로 비활성만 된다.
   */
  it('locks the run CTA while the trigger request is still in flight', () => {
    pollingState.triggering = true;
    pollingState.canRunTest = false;
    renderCard([makeResource({ credentialId: 'Key1' })]);

    const button = screen.getByRole('button', { name: '실행' });
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

  it('disables the run CTA when a row has no credential, without touching Connection Status', () => {
    renderCard([makeResource({ credentialId: null })]);
    // Connection Status only ever says what the agent reported — nothing ran, so no verdict.
    expect(within(screen.getByRole('table')).queryByText('성공')).toBeNull();
    expect(screen.queryByText('자격 증명 필요')).toBeNull();
    // A block that has a reason to state keeps the button focusable (aria-disabled) so the
    // tooltip carrying it is reachable; pressing it still starts nothing.
    const run = screen.getByRole('button', { name: '실행' });
    expect(run.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(run);
    expect(triggerMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /연동 논리 DB 관리하기/ })).toHaveProperty('disabled', true);
  });

  it('carries the block reason in a tooltip the keyboard can reach', async () => {
    renderCard([makeResource({ credentialId: null })]);
    const run = screen.getByRole('button', { name: '실행' });
    expect(run.getAttribute('title')).toBeNull();
    // async act — the tooltip defers its coordinate commit to a microtask.
    await act(async () => {
      run.focus();
    });
    expect(document.activeElement).toBe(run);
    expect(screen.getByText(/Credential 미설정 1건 —/)).toBeTruthy();
  });

  it('enables the run CTA when every row has a credential selected', () => {
    renderCard([makeResource({ credentialId: 'Key1' }), makeResource({ resourceId: 'res-2', credentialId: 'Key2' })]);
    expect(screen.getByRole('button', { name: '실행' })).toHaveProperty('disabled', false);
  });

  it('does not require a credential for engines that connect without one (Athena)', () => {
    renderCard([
      makeResource({ resourceId: 'athena-1', databaseType: 'athena', credentialId: null }),
    ]);
    expect(screen.getByText('불필요')).toBeTruthy();
    expect(screen.queryByText('자격 증명 필요')).toBeNull();
    expect(screen.getByRole('button', { name: '실행' })).toHaveProperty('disabled', false);
  });

  // 판정이 mysql·postgresql·redshift 허용 목록이던 동안 이 엔진들은 "불필요"로 찍혔다 —
  // 실제로는 계정이 있어야 붙고, IDC step 5 는 같은 엔진에 이미 요구하고 있었다.
  it.each(['mssql', 'oracle', 'mongodb', 'mariadb'])(
    'requires a credential for %s, and blocks the run CTA until one is set',
    (databaseType) => {
      renderCard([makeResource({ resourceId: `${databaseType}-1`, databaseType, credentialId: null })]);
      expect(screen.queryByText('불필요')).toBeNull();
      expect(screen.getByRole('button', { name: /Credential 수정 — 현재 미설정/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: '실행' }).getAttribute('aria-disabled')).toBe('true');
    },
  );

  it('counts Credential-free engines as neither, and the notice filters the table', () => {
    // Rows are addressed here by Resource Name; the Resource ID column has its own test.
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
    expect(screen.getByText('Credential 미설정 알림')).toBeTruthy();
    expect(screen.getByText(/지정되지 않았어요/).textContent).toContain('1건');

    fireEvent.click(screen.getByRole('button', { name: '미설정만 보기' }));
    expect(screen.getByText('named-missing')).toBeTruthy();
    expect(screen.queryByText('named-athena')).toBeNull();
    expect(screen.queryByText('named-cred')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByText('named-athena')).toBeTruthy();
  });

  // The id column is keyed on the UNIT, not on the first member: an Athena row stands for a
  // region and its verdict comes back on `athena_region_resource_id`, so that is the id a
  // reader chasing this row has to copy. The databases underneath leave the cell empty —
  // their own ids are the region's path plus the name the row already prints.
  it('prints the unit id, and drops it inside an Athena fold', async () => {
    renderCard([
      makeResource({
        resourceId: 'athena:acct:ap-northeast-2:AwsDataCatalog/cpn_logs',
        resourceName: 'cpn_logs',
        databaseType: 'athena',
        credentialId: null,
        athenaRegionResourceId: 'athena:acct:ap-northeast-2/AwsDataCatalog',
      }),
      makeResource({ resourceId: 'arn:aws:rds:…:db:space-prod', resourceName: 'space-prod' }),
    ]);
    expect(screen.getByText('athena:acct:ap-northeast-2/AwsDataCatalog')).toBeTruthy();
    expect(screen.getByText('arn:aws:rds:…:db:space-prod')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /데이터베이스 목록 펼치기/ }));
    // The child row is present, and every cell of it after the name is blank — including
    // the id one, which must exist so the row stays in register with the head.
    const childName = screen.getByText('cpn_logs');
    const childRow = childName.closest('tr') as HTMLTableRowElement;
    expect(childRow.cells).toHaveLength(9);
    expect(childRow.cells[1].textContent).toBe('');
    expect(
      screen.queryByText('athena:acct:ap-northeast-2:AwsDataCatalog/cpn_logs'),
    ).toBeNull();
  });

  // 0 미등록은 정상 상태다 — 그때 알림이 남아 있으면 "할 일 없음"을 상시로 말하게 된다.
  it('draws no notice when every credential-requiring row has one', () => {
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
  // the reported result; the credential gates the run CTA, not the verdict.
  it('reports a SUCCESS unit as connected even with no credential selected', () => {
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ resourceId: 'res-1', credentialId: null })]);
    // Row tag and the summary count both say 성공; the sentence states the verdict.
    expect(screen.getAllByText('성공').length).toBeGreaterThan(0);
    expect(screen.getByText('모든 리소스가 연결에 성공했어요')).toBeTruthy();
  });

  it('the run CTA triggers the async test (no local credential change → no credential PUT)', async () => {
    renderCard([makeResource({ credentialId: 'Key1' })]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '실행' }));
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

    // The run CTA then triggers the test without a second PUT.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '실행' }));
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
          refreshProject={() => {}}
        polling={makePolling()}
      />
    );
    const { rerender } = render(element());
    return () => rerender(element());
  };

  it('hydrates row statuses from latest_version on mount without a run-CTA click (B3)', async () => {
    // Simulate a prior SUCCESS result already in the mock on cold load.
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    renderCard(confirmed);
    // Row must show Success and CTA must be enabled — no run-CTA click.
    expect((await screen.findAllByText('성공')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '승인 요청' })).toHaveProperty('disabled', false),
    );
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('enables 승인 요청 when latest_version.connectionStatus is SUCCESS (B2)', async () => {
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    const rerender = renderStable(confirmed);

    // Poll settles SUCCESS after the run — approval gate reads uiState directly.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '실행' }));
    });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    act(() => rerender());

    expect((await screen.findAllByText('성공')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '승인 요청' })).toHaveProperty('disabled', false),
    );
  });

  it('shows Fail and keeps 승인 요청 disabled when latest_version.connectionStatus is FAIL', async () => {
    const confirmed = [makeResource({ resourceId: 'res-1', credentialId: 'Key1' })];
    const rerender = renderStable(confirmed);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '실행' }));
    });
    pollingState.uiState = 'FAIL';
    pollingState.latestJob = makeJob('FAIL', [agentResult('res-1', 'FAIL')]);
    act(() => rerender());
    // 표 안으로 좁힌다 — 카운트 줄의 범례도 '실패'를 제 텍스트 노드로 갖는다.
    expect(within(await screen.findByRole('table')).getByText('실패')).toBeTruthy();
    // FAIL 의 정답 행동은 재실행 하나다 — 승인 CTA 는 비활성이 아니라 슬롯에서 아예 빠진다.
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy();
  });

  it('seals the card on CONFIRMED — no CTA at all, history stays reachable', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({ test_connection_status: 'CONFIRMED' });
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(await screen.findByText('연결 테스트 완료 확인됨')).toBeTruthy();
    expect(screen.getByText('최근 수행 결과 기준')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
    expect(screen.queryByRole('button', { name: /다시 실행/ })).toBeNull();
    expect(screen.getByRole('button', { name: '실행 이력' })).toBeTruthy();
  });

  // 마지막 실행 뒤 확정이 바뀌면 CONFIRMED 인데 현재 유닛 보고가 0건일 수 있다 — 그때
  // "성공 0 · 실패 0" 은 판정 없음만 반복한다. settled 와 같은 대상 서술로 접는다.
  it('falls back to the target description when CONFIRMED has no reports on current units', async () => {
    getCompletionStatusMock.mockResolvedValueOnce({ test_connection_status: 'CONFIRMED' });
    pollingState.uiState = 'SUCCESS';
    // The run reported on res-old only; the current unit is res-1.
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-old', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(await screen.findByText('연결 테스트 완료 확인됨')).toBeTruthy();
    // 세그먼트 하나짜리 카운트 줄 — 판정이 없어도 줄의 문법은 다른 국면과 같다.
    expect(screen.getByText('대상 리소스').textContent).toBe('대상 리소스1');
  });

  // 실패한 완료 상태 조회가 닫힌 게이트와 같은 픽셀이면, 이유 없이 비활성인 승인 버튼만
  // 남는다 — 실패는 빈 결과가 아니다. 한 줄 + 재시도가 그 구분이다.
  it('says so when the completion read fails, and 다시 시도 refires it', async () => {
    getCompletionStatusMock.mockRejectedValueOnce(new Error('500'));
    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
    renderCard([makeResource({ credentialId: 'Key1' })]);

    expect(await screen.findByText(/연결 테스트 완료 상태 조회에 실패했습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '승인 요청' })).toHaveProperty('disabled', true);

    // Retry hits the default open verdict — the line clears and the gate opens.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '승인 요청' })).toHaveProperty('disabled', false),
    );
    expect(screen.queryByText(/완료 상태 조회에 실패했습니다/)).toBeNull();
  });

  /**
   * 시안 B — `연동 논리 DB` 는 한 열이 아니라 그룹 머리이고, 그 아래 대상·제외·관리가 선다.
   * 수는 최신 실행의 리소스별 요약에서 오고, **없는 값은 0 이 아니다**: 이번 실행이 그
   * 유닛을 말하지 않았으면 `—` 다.
   */
  describe('연동 논리 DB 그룹', () => {
    it('spans 대상·제외·관리 with one group head', async () => {
      renderCard([makeResource({ credentialId: 'Key1' })]);
      const group = await screen.findByRole('columnheader', { name: '연동 논리 DB' });
      expect(group.getAttribute('colspan')).toBe('3');
      expect(group.getAttribute('scope')).toBe('colgroup');
    });

    it('draws the reported counts, and — (not 0) for a unit the run never mentioned', async () => {
      getSummariesMock.mockResolvedValue([
        { resource_id: 'res-1', logical_database_count: 8, excluded_logical_database_count: 3 },
      ]);
      renderCard([
        makeResource({ resourceId: 'res-1', resourceName: 'named-counted', credentialId: 'Key1' }),
        makeResource({ resourceId: 'res-2', resourceName: 'named-silent', credentialId: 'Key1' }),
      ]);

      const counted = (await screen.findByText('named-counted')).closest(
        'tr',
      ) as HTMLTableRowElement;
      expect(counted.cells[6].textContent).toBe('8개');
      expect(counted.cells[7].textContent).toBe('3개');
      // 관리 칸은 건수와 무관하게 언제나 문이다.
      expect(within(counted.cells[8]).getByRole('button', { name: /관리하기/ })).toBeTruthy();

      const silent = screen.getByText('named-silent').closest('tr') as HTMLTableRowElement;
      expect(silent.cells[6].textContent).toBe('—');
      expect(silent.cells[7].textContent).toBe('—');
    });

    /**
     * Athena 는 4단계부터 리전이 리소스라 결과가 리전 id(`athena_region_resource_id`) 한 줄로
     * 달려 온다. 조회는 **단위 id** 로 한다(`unitCounts`). 실행이 그 리전을 두고 보고한 수는
     * 엔진이 논리 DB 를 관리하든 아니든 사실이므로 `대상` 은 그 수를 그대로 그린다 —
     * 접힌 자식 행을 펴서 세는 수와 같은 수다.
     */
    it('draws the reported count on a folded Athena row, keyed on the region id', async () => {
      getSummariesMock.mockResolvedValue([
        {
          resource_id: 'athena:acct:ap-northeast-2/AwsDataCatalog',
          logical_database_count: 5,
          excluded_logical_database_count: 1,
        },
      ]);
      renderCard([
        makeResource({
          resourceId: 'athena:acct:ap-northeast-2:AwsDataCatalog/cpn_logs',
          resourceName: 'cpn_logs',
          databaseType: 'athena',
          credentialId: null,
          athenaRegionResourceId: 'athena:acct:ap-northeast-2/AwsDataCatalog',
        }),
      ]);

      const unitRow = (
        await screen.findByText('athena:acct:ap-northeast-2/AwsDataCatalog')
      ).closest('tr') as HTMLTableRowElement;
      await waitFor(() => expect(unitRow.cells[6].textContent).toBe('5개'));
      // 제외는 실행이 1 이라고 보고해도 정책이 이긴다 — 제외라는 개념이 없는 엔진이다.
      expect(unitRow.cells[7].textContent).toBe('제외 불가');
      expect(screen.queryByText('1개')).toBeNull();
    });

    /**
     * 회차가 바뀌어 다시 읽었는데 그 조회가 실패하면, 화면에 남은 수는 이번 회차가 보고한
     * 값이 아니다 — 실패는 빈 결과가 아니지만, 낡은 수를 그대로 두는 것은 "이번 실행이 그
     * 수를 말했다"는 거짓말이다. 맵을 비워 `—` 로 되돌린다.
     */
    it('clears the counts to — when the refetch for a new run fails', async () => {
      getSummariesMock.mockResolvedValue([
        { resource_id: 'res-1', logical_database_count: 12, excluded_logical_database_count: 3 },
      ]);
      const confirmed = [
        makeResource({ resourceId: 'res-1', resourceName: 'named-counted', credentialId: 'Key1' }),
      ];
      pollingState.uiState = 'SUCCESS';
      pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
      const rerender = renderStable(confirmed);

      const row = () => screen.getByText('named-counted').closest('tr') as HTMLTableRowElement;
      await waitFor(() => expect(row().cells[6].textContent).toBe('12개'));

      // 다음 회차가 정착 → runVersion 이 바뀌어 effect 가 다시 읽는다. 이번엔 실패.
      getSummariesMock.mockRejectedValue(new Error('503'));
      pollingState.latestJob = {
        ...makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]),
        test_connection_version: 2,
      };
      await act(async () => {
        rerender();
      });

      await waitFor(() => expect(row().cells[6].textContent).toBe('—'));
      expect(row().cells[7].textContent).toBe('—');
    });

    /**
     * 언제 읽는가는 그려진 수만 봐서는 잠기지 않는다 — 아래 세 테스트는 **호출**을 센다.
     *
     * 도는 동안에는 읽지 않는다: 이 회차의 건수는 아직 없고, 폴링은 몇 초마다 돌아온다.
     * 게이트가 없으면 폴링이 그대로 조회로 번역돼, 실행 한 번이 표를 몇 번이고 다시 읽힌다.
     */
    it('does not read the counts while a run is in flight, however often the poll turns', async () => {
      pollingState.uiState = 'RUNNING';
      pollingState.latestJob = {
        ...makeJob('RUNNING', [agentResult('res-1', 'RUNNING')]),
        test_connection_version: 2,
      };
      const rerender = renderStable([
        makeResource({ resourceId: 'res-1', resourceName: 'named-counted', credentialId: 'Key1' }),
      ]);
      expect(await screen.findByText('named-counted')).toBeTruthy();
      expect(getSummariesMock.mock.calls.length).toBe(0);

      // 폴링이 새 회차를 물고 와 runVersion 이 바뀌어도, 도는 중이면 여전히 읽지 않는다.
      pollingState.latestJob = {
        ...makeJob('RUNNING', [agentResult('res-1', 'RUNNING')]),
        test_connection_version: 3,
      };
      await act(async () => {
        rerender();
      });
      expect(getSummariesMock.mock.calls.length).toBe(0);
    });

    // …그리고 정착하면 읽는다. 게이트는 미루는 것이지 끄는 것이 아니다.
    it('reads the counts once the in-flight run settles', async () => {
      pollingState.uiState = 'RUNNING';
      pollingState.latestJob = {
        ...makeJob('RUNNING', [agentResult('res-1', 'RUNNING')]),
        test_connection_version: 2,
      };
      const rerender = renderStable([
        makeResource({ resourceId: 'res-1', resourceName: 'named-counted', credentialId: 'Key1' }),
      ]);
      expect(await screen.findByText('named-counted')).toBeTruthy();
      expect(getSummariesMock.mock.calls.length).toBe(0);

      pollingState.uiState = 'SUCCESS';
      pollingState.latestJob = {
        ...makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]),
        test_connection_version: 2,
      };
      await act(async () => {
        rerender();
      });
      expect(getSummariesMock.mock.calls.length).toBe(1);
    });

    /**
     * 대상을 갈아타면 옛 대상의 수는 새 화면에 서면 안 된다 — resourceId 는 대상 간에 겹칠
     * 수 있어서, 도장 없는 맵은 남의 수를 이 행에 조용히 붙인다. 새 조회가 답하기 전까지는
     * 이 행에 대해 아는 것이 없으므로 `—` 다.
     */
    it('does not leak the previous target counts into a target it has not read yet', async () => {
      getSummariesMock.mockResolvedValue([
        { resource_id: 'res-1', logical_database_count: 8, excluded_logical_database_count: 3 },
      ]);
      pollingState.uiState = 'SUCCESS';
      pollingState.latestJob = makeJob('SUCCESS', [agentResult('res-1', 'SUCCESS')]);
      const confirmed = [
        makeResource({ resourceId: 'res-1', resourceName: 'named-counted', credentialId: 'Key1' }),
      ];
      // renderStable 은 targetSourceId 를 1 로 붙박아 두므로, 대상을 갈아타는 것은 여기서만 한다.
      const element = (targetSourceId: number) => (
        <ConnectionTestCard
          targetSourceId={targetSourceId}
          confirmed={confirmed}
          refreshProject={() => {}}
          polling={makePolling()}
        />
      );
      const { rerender } = render(element(1));

      const row = () => screen.getByText('named-counted').closest('tr') as HTMLTableRowElement;
      await waitFor(() => expect(row().cells[6].textContent).toBe('8개'));

      // 대상 2 의 조회는 아직 떠 있다 — 그 사이에 그려지는 것은 1 의 수가 아니다.
      let answerForTwo: (rows: Record<string, unknown>[]) => void = () => {};
      getSummariesMock.mockImplementation(
        () =>
          new Promise<Record<string, unknown>[]>((resolve) => {
            answerForTwo = resolve;
          }),
      );
      await act(async () => {
        rerender(element(2));
      });
      expect(row().cells[6].textContent).toBe('—');
      expect(row().cells[7].textContent).toBe('—');

      // 도장이 맞는 답이 오면 그때 선다 — 게이트는 늦추는 것이지 비우는 것이 아니다.
      await act(async () => {
        answerForTwo([
          { resource_id: 'res-1', logical_database_count: 2, excluded_logical_database_count: 1 },
        ]);
      });
      await waitFor(() => expect(row().cells[6].textContent).toBe('2개'));
    });

    // 논리 DB 가 없는 엔진은 `대상` 도 보고가 있을 때만 그린다 — 없으면 —, 지어내지 않는다.
    it('leaves 대상 blank for an engine with no logical DBs when the run reported nothing', () => {
      renderCard([
        makeResource({
          resourceId: 'dynamo-1',
          resourceName: 'named-dynamo',
          databaseType: 'dynamodb',
          credentialId: null,
        }),
      ]);
      const row = screen.getByText('named-dynamo').closest('tr') as HTMLTableRowElement;
      expect(row.cells[6].textContent).toBe('—');
      expect(row.cells[7].textContent).toBe('제외 불가');
    });

    /**
     * 관리 칸은 빈 칸이다 — 한 행에서 같은 사실을 두 번 말하지 않는다. 옆 칸의 `제외 불가`
     * 가 이미 이 엔진에 제외 정책이 없다고 답했고, `설정 불필요` 는 그 말의 사본이었다.
     */
    it('leaves 관리 empty — no 관리하기 button and no 설정 불필요 note — for those engines', () => {
      renderCard([
        makeResource({
          resourceId: 'dynamo-1',
          resourceName: 'named-dynamo',
          databaseType: 'dynamodb',
          credentialId: null,
        }),
      ]);
      const row = screen.getByText('named-dynamo').closest('tr') as HTMLTableRowElement;
      expect(row.cells[8].textContent).toBe('');
      expect(within(row.cells[8]).queryByRole('button', { name: /관리하기/ })).toBeNull();
      expect(screen.queryByText('설정 불필요')).toBeNull();
    });
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

/**
 * Console shape (LIN-99) — the LIN-96 ledger, pinned: name 162 · id 186 · dbType 142 ·
 * region 156 · cred 200 · conn 104 · logicalDb 96 · logicalExcl 96 · logicalManage 96,
 * Σ 1238 on the table's minWidth. name and id are the flex PAIR every other resource table
 * declares, so the SINK is id (the last flex): it renders `auto` while name renders its share
 * of the floor sum (162/1238) and the seven sized columns render their ledger px.
 * cred is 200 by owner order (2026-08-27), down from the 264 ordered on 2026-08-23: at the
 * 14px row the longest seeded name measures 219.74px, so 264 was down to 8.26px of slack,
 * and the next-longest name is 149.21 — a 70px cliff. 200 = 149.21 + 36 padding + 14.79,
 * which fits every seeded name but that one outlier, and the outlier ellipsizes with a
 * `title` tooltip. 180 was the retired Key1/Key2 synthetic-name width.
 * The three logical leaves are 96 because IDC's are (IDC_COLUMN_WIDTHS) and so are the
 * confirmed table's — the tables that share this two-tier head share its gauge.
 */
describe('ConnectionTestCard — console column spec', () => {
  it('holds the 1238 floor with Resource ID as the sink', async () => {
    renderCard([makeResource({})]);
    const table = (await screen.findByRole('table')) as HTMLTableElement;
    expect(table.style.minWidth).toBe('1238px');
    // 그룹 셀은 폭을 갖지 않는다(빈 문자열) — 바닥은 잎이 전부 진다.
    const widths = Array.from(table.querySelectorAll('thead th')).map(
      (th) => (th as HTMLElement).style.width,
    );
    expect(widths).toEqual([
      '13.0856%',
      'auto',
      '142px',
      '156px',
      '200px',
      '104px',
      '',
      '96px',
      '96px',
      '96px',
    ]);
  });
});
