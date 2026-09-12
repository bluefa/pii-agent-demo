// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';

/**
 * 실행 단추와 설치 미완료 판정 사이의 배선 — 순수 함수 테스트가 못 보는 자리.
 *
 * `installPendingGate` 을 따로 단언해도 이 결함은 안 잡힌다: 게이트는 옳게 `needed` 를
 * 내면서 TcTab 이 그 값을 안 읽으면 실행은 그대로 나가고, 화면은 예고한 실패를 그냥
 * 만든다. 그래서 여기서는 **`triggerTestConnection` 이 불렸는가**를 본다.
 */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1010' }));

const triggerTestConnection = vi.fn().mockResolvedValue(undefined);

/**
 * Credential 이 필요한 엔진(MySQL) 하나. 배정은 확정 행의 `credential_id` 가 지고,
 * 그 한 칸이 비면 실행 단추가 잠긴다 — 이 티켓의 예보보다 앞서는 유일한 게이트다.
 */
const confirmedRow = (credentialId: number | null): ConfirmedIntegrationResourceItem =>
  ({
    resource_id: 'arn:aws:rds:ap-northeast-2:1:cluster:db-1',
    resource_name: 'db-1',
    database_type: 'mysql',
    database_region: 'ap-northeast-2',
    ...(credentialId !== null && { credential_id: credentialId }),
  }) as unknown as ConfirmedIntegrationResourceItem;

let credentialId: number | null = 7;

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn(async () => ({ resource_infos: [confirmedRow(credentialId)] })),
  getSecrets: vi.fn().mockResolvedValue([]),
  triggerTestConnection: (...args: unknown[]) => triggerTestConnection(...args),
}));

vi.mock('@/app/lib/api/task-queue-requests', () => ({
  getApprovalRequestLatest: vi.fn().mockRejectedValue(new Error('no request')),
}));

vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard',
  () => ({ ConfirmedInfoCard: () => null }),
);

vi.mock('@/app/admin/pipelines/_components/usePlToast', () => ({
  usePlToast: () => ({ show: vi.fn() }),
}));

/** 설치 상태 — 셀 하나가 안 끝난 리소스 하나. */
const getAwsInstallationStatus = vi.fn();
vi.mock('@/app/lib/api/aws', () => ({
  getAwsInstallationStatus: (...args: unknown[]) => getAwsInstallationStatus(...args),
}));

const installing = {
  lastCheck: { status: 'SUCCESS' as const, checkedAt: '2026-08-31T01:00:00Z' },
  resources: [
    {
      resourceId: 'arn:aws:rds:ap-northeast-2:1:cluster:db-1',
      resourceName: 'db-1',
      installationStatus: 'IN_PROGRESS' as const,
      serviceTerraform: { status: 'IN_PROGRESS' as const, guide: null },
      bdcServiceTerraform: { status: 'COMPLETED' as const, guide: null },
      bdcCommonTerraform: { status: 'COMPLETED' as const, guide: null },
    },
  ],
};

const settled = {
  ...installing,
  resources: [
    {
      ...installing.resources[0],
      installationStatus: 'COMPLETED' as const,
      serviceTerraform: { status: 'COMPLETED' as const, guide: null },
    },
  ],
};

const { TcTab } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab'
);

const renderTab = (): void => {
  render(
    <TcTab
      targetSourceId={1010}
      isIdc={false}
      provider="aws"
      manualInstall
      latest={null}
      results={[]}
      statusLoaded
      latestFailed={false}
      processStatus={null}
      tcStatus={null}
      tcStatusFailed={false}
      onStatusReload={vi.fn()}
    />,
  );
};

const runButton = (): HTMLElement => screen.getByRole('button', { name: /연결 테스트 실행/ });

describe('TcTab — 설치 미완료 확인', () => {
  beforeEach(() => {
    triggerTestConnection.mockClear();
    getAwsInstallationStatus.mockClear();
    credentialId = 7;
    getAwsInstallationStatus.mockResolvedValue(installing);
  });

  it('안 끝난 설치가 있으면 확인 모달이 먼저 서고, 실행은 나가지 않는다', async () => {
    renderTab();
    await screen.findByText('설치가 끝나지 않아 연결 테스트가 실패합니다');

    fireEvent.click(runButton());

    expect(screen.getByText('설치가 끝나지 않았습니다')).toBeTruthy();
    expect(triggerTestConnection).not.toHaveBeenCalled();
  });

  it('확인하면 그때 한 번 실행된다', async () => {
    renderTab();
    await screen.findByText('설치가 끝나지 않아 연결 테스트가 실패합니다');

    fireEvent.click(runButton());
    fireEvent.click(screen.getByRole('button', { name: '실패를 감수하고 실행' }));

    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledTimes(1));
    expect(triggerTestConnection).toHaveBeenCalledWith(1010);
  });

  it('취소하면 모달만 닫히고 아무것도 나가지 않는다', async () => {
    renderTab();
    await screen.findByText('설치가 끝나지 않아 연결 테스트가 실패합니다');

    fireEvent.click(runButton());
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByText('설치가 끝나지 않았습니다')).toBeNull();
    expect(triggerTestConnection).not.toHaveBeenCalled();
  });

  it('설치가 끝났으면 확인 없이 곧바로 실행된다', async () => {
    getAwsInstallationStatus.mockResolvedValue(settled);
    renderTab();
    await waitFor(() => expect(getAwsInstallationStatus).toHaveBeenCalled());

    fireEvent.click(runButton());

    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('설치가 끝나지 않았습니다')).toBeNull();
  });

  it('설치 상태를 못 읽었으면(unknown) 막아서지 않는다 — 확인도, 경고도 없다', async () => {
    getAwsInstallationStatus.mockRejectedValue(new Error('502'));
    renderTab();
    await waitFor(() => expect(getAwsInstallationStatus).toHaveBeenCalled());

    fireEvent.click(runButton());

    await waitFor(() => expect(triggerTestConnection).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('설치가 끝나지 않았습니다')).toBeNull();
    expect(screen.queryByText('설치가 끝나지 않아 연결 테스트가 실패합니다')).toBeNull();
  });

  it('Credential 미설정이 앞선다 — 단추가 잠겨 확인 모달까지 오지 않는다', async () => {
    credentialId = null;
    renderTab();
    await screen.findByText(/Credential 미설정/);

    fireEvent.click(runButton());

    expect(screen.queryByText('설치가 끝나지 않았습니다')).toBeNull();
    expect(triggerTestConnection).not.toHaveBeenCalled();
  });
});
