// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { AwsInstallationStatus, AwsInstallStepValue } from '@/lib/types';

/**
 * 설치 미완료 상태에서 실행을 누르면 한 번 되묻는가 — 배선을 그대로 걷는 트립와이어.
 *
 * `installGate` 의 순수 테스트는 판정만 본다. 여기서 잡으려는 결함은 그 판정이 실제로
 * 실행 버튼에 닿는가다: 창이 뜨는가, 창을 확인하면 요청이 나가는가, 판정이 완료거나
 * 확인 불가일 때 창이 서지 않는가. 그래서 카드도 모달도 진짜를 세운다.
 *
 * Credential 이 필요 없는 리소스(Athena — IAM 으로 붙는다)로 세운다. 미설정이 하나라도
 * 있으면 실행 버튼은 그 사유로 잠기고, 이 테스트가 보려는 갈래에 닿지 못한다.
 */
const confirmedRows: ConfirmedIntegrationResourceItem[] = [
  {
    resource_id: 'athena:1:ap-northeast-2:AwsDataCatalog/sampledb',
    resource_name: 'sampledb',
    database_type: 'athena',
    database_region: 'ap-northeast-2',
    athena_region_resource_id: 'athena:1:ap-northeast-2/AwsDataCatalog',
  } as ConfirmedIntegrationResourceItem,
];

const triggerTestConnection = vi.fn().mockResolvedValue(undefined);

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn().mockResolvedValue({ resource_infos: confirmedRows }),
  getSecrets: vi.fn().mockResolvedValue([]),
  triggerTestConnection: (id: number) => triggerTestConnection(id),
}));

vi.mock('@/app/lib/api/task-queue-requests', () => ({
  getApprovalRequestLatest: vi.fn().mockRejectedValue(new Error('no request')),
}));

// 확정 정보 표는 이 테스트의 관심 밖이고 자기 몫의 조회를 또 건다.
vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard',
  () => ({ ConfirmedInfoCard: () => null }),
);

const getAwsInstallationStatus = vi.fn();
vi.mock('@/app/lib/api/aws', () => ({
  getAwsInstallationStatus: (id: number) => getAwsInstallationStatus(id),
}));

const getGcpInstallationStatus = vi.fn();
vi.mock('@/app/lib/api/gcp', () => ({
  getGcpInstallationStatus: (id: number) => getGcpInstallationStatus(id),
}));

const { TcTab } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab'
);

const step = (status: AwsInstallStepValue) => ({ status, guide: null });

const installStatus = (serviceTerraform: AwsInstallStepValue): AwsInstallationStatus => ({
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
  roleVerify: { status: 'COMPLETED', roleArn: null },
  resources: [
    {
      resourceId: 'athena:1:ap-northeast-2/AwsDataCatalog',
      resourceName: 'AwsDataCatalog',
      installationStatus: serviceTerraform,
      serviceTerraform: step(serviceTerraform),
      bdcServiceTerraform: step('COMPLETED'),
      bdcCommonTerraform: step('COMPLETED'),
    },
  ],
});

const onOpenInfraTab = vi.fn();

const renderTab = (provider = 'aws') =>
  render(
    <TcTab
      targetSourceId={1}
      isIdc={false}
      latest={null}
      results={[]}
      statusLoaded
      latestFailed={false}
      onStatusReload={vi.fn()}
      provider={provider}
      manualInstall={false}
      onOpenInfraTab={onOpenInfraTab}
    />,
  );

const runButton = () => screen.getByRole('button', { name: '연결 테스트 실행' });

beforeEach(() => {
  triggerTestConnection.mockClear();
  onOpenInfraTab.mockClear();
  getAwsInstallationStatus.mockReset();
  getGcpInstallationStatus.mockReset();
});

describe('TcTab — 설치가 덜 끝난 채로 실행하기', () => {
  it('미완료면 경고 상자가 서고, 실행은 확인 창을 먼저 연다', async () => {
    getAwsInstallationStatus.mockResolvedValue(installStatus('IN_PROGRESS'));
    renderTab();

    await screen.findByText('설치가 아직 끝나지 않았습니다');
    // 잠그지 않는다 — 사유 있는 잠금(Credential)과 달리 실행은 열려 있어야 한다.
    // `blocked` 도 아니다: 그것은 aria-disabled 로 얼굴만 잠그는 자리이고, 여기서는
    // 누를 수 있어야 확인 창이 뜬다.
    expect(runButton().hasAttribute('disabled')).toBe(false);
    expect(runButton().getAttribute('aria-disabled')).toBeNull();

    fireEvent.click(runButton());
    await screen.findByText('설치가 끝나기 전에 실행할까요?');
    expect(triggerTestConnection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '그래도 실행' }));
    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledWith(1));
  });

  it('경고 상자의 두 길이 실제로 닿는다 — 탭 전환과 재조회', async () => {
    getAwsInstallationStatus.mockResolvedValue(installStatus('IN_PROGRESS'));
    renderTab();

    await screen.findByText('설치가 아직 끝나지 않았습니다');
    expect(getAwsInstallationStatus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '인프라 작업 탭에서 확인' }));
    expect(onOpenInfraTab).toHaveBeenCalledTimes(1);

    // 다시 확인은 같은 GET 을 다시 부른다 — 계약에 재점검을 시키는 오퍼레이션이 없다.
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    await waitFor(() => expect(getAwsInstallationStatus).toHaveBeenCalledTimes(2));
  });

  it('취소하면 아무 요청도 나가지 않는다', async () => {
    getAwsInstallationStatus.mockResolvedValue(installStatus('FAIL'));
    renderTab();

    await screen.findByText('설치가 아직 끝나지 않았습니다');
    fireEvent.click(runButton());
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByText('설치가 끝나기 전에 실행할까요?')).toBeNull();
    expect(triggerTestConnection).not.toHaveBeenCalled();
  });

  it('완료면 창 없이 바로 실행한다', async () => {
    getAwsInstallationStatus.mockResolvedValue(installStatus('COMPLETED'));
    renderTab();

    await screen.findByText('완료');
    fireEvent.click(runButton());

    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledWith(1));
    expect(screen.queryByText('설치가 끝나기 전에 실행할까요?')).toBeNull();
  });

  it('확인할 수 없으면 경고도 창도 없다 — 못 읽은 것을 근거로 되묻지 않는다', async () => {
    getAwsInstallationStatus.mockRejectedValue(new Error('boom'));
    renderTab();

    await screen.findByText(/확인할 수 없음/);
    expect(screen.queryByText('설치가 아직 끝나지 않았습니다')).toBeNull();

    fireEvent.click(runButton());
    expect(screen.queryByText('설치가 끝나기 전에 실행할까요?')).toBeNull();
    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledWith(1));
  });

  it('실패한 재조회는 직전 성공의 사유를 물려 쓰지 않는다', async () => {
    // 첫 조회는 「점검이 실패했다」고 사유까지 말한다.
    getAwsInstallationStatus.mockResolvedValueOnce({
      ...installStatus('COMPLETED'),
      lastCheck: { status: 'FAILED', checkedAt: '2026-08-31T01:00:00Z', failReason: 'AWS_TIMEOUT' },
    });
    renderTab();
    await screen.findByText(/AWS_TIMEOUT/);

    // 두 번째는 조회 자체가 실패한다 — 그때 화면에 남아 있던 사유는 이번 일의 사유가 아니다.
    getAwsInstallationStatus.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));

    await screen.findByText(/상태 확인 실패/);
    expect(screen.queryByText(/AWS_TIMEOUT/)).toBeNull();
  });
});

describe('TcTab — 제약이 없는 프로바이더', () => {
  it('GCP 는 완료라 말하지 않는다 — 셀 것이 없으므로 n/N 도 없다', async () => {
    getGcpInstallationStatus.mockResolvedValue({
      last_check: { status: 'SUCCESS', checked_at: '2026-08-31T01:00:00Z' },
      resources: [
        {
          resource_id: 'sql-1',
          resource_name: 'sql-1',
          installation_status: 'IN_PROGRESS',
          service_side_subnet_creation: { status: 'COMPLETED' },
          service_side_terraform_apply: { status: 'IN_PROGRESS' },
          bdc_side_terraform_apply: { status: 'IN_PROGRESS' },
        },
      ],
    });
    renderTab('gcp');

    await screen.findByText('제약 없음');
    expect(screen.queryByText('완료')).toBeNull();
    expect(screen.queryByText(/^· \d+\/\d+$/)).toBeNull();
    // 경고하지 않는다: 여기서 미완료인 단계는 연결 테스트를 막지 않는다.
    expect(screen.queryByText('설치가 아직 끝나지 않았습니다')).toBeNull();
  });
});
