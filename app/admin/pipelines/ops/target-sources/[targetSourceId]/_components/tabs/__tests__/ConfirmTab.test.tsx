// @vitest-environment jsdom
/**
 * 확정 정보 탭의 축은 둘이다 — 연동 요청 확인 · 확정 정보.
 *
 * 2026-08-30 오너 지시로 셋째 축(설치 · Terraform)이 이 탭에서 빠졌다. 같은 릴리스에서
 * 인프라 작업 탭이 그 상태를 소유했기 때문이다. 여기 첫 두 테스트가 트립와이어다 —
 * 다음 라운드가 조용히 되돌리지 못하게 밴드 칸 수와 어휘를 함께 잰다.
 *
 * 세 번째·네 번째는 그 반대편을 지킨다: terraform-status 콜 자체는 남았고, 남은 이유가
 * `latest_confirmed_at`(확정 시각) 하나라는 것. 확정 계약(`{ resource_infos }`)에는
 * 시각이 없어서 이 화면의 확정 시각은 그 응답에만 있다.
 */
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ConfirmedIntegrationResponse, TerraformStatusResponse } from '@/app/lib/api';

const getApprovalRequestLatest = vi.fn();
const getConfirmedIntegration = vi.fn();
const getTerraformStatus = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => {
  // 요청 pane 은 이 모듈의 순수 헬퍼(idcAddressKind 등)를 계속 쓴다 — fetch 만 세운다.
  const mod = await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>();
  return {
    ...mod,
    getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatest(...args),
    getNlbTable: async () => [],
    getNlbIndexMappings: async () => [],
  };
});
vi.mock('@/app/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/lib/api')>();
  return {
    ...mod,
    getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
    getTerraformStatus: (...args: unknown[]) => getTerraformStatus(...args),
  };
});

import { ConfirmTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab';

const CSP: RawTargetSourceDetail = { cloud_provider: 'AWS' };

const confirmedRow = (index: number): ConfirmedIntegrationResponse['resource_infos'][number] => ({
  resource_id: `res-${index}`,
  resource_type: 'RDS',
  database_type: 'mysql',
  database_region: 'ap-northeast-2',
  resource_name: `confirmed-${index}`,
  port: 3306,
  host: `db-${index}.example.internal`,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  athena_region_resource_id: null,
  credential_id: 'cred-1',
});

/** 확정 시각의 유일한 출처. 08-14 14:00 KST. */
const CONFIRMED_AT = '2026-08-14T05:00:00Z';

const terraformStatus = (): TerraformStatusResponse => ({
  overall_state: 'APPLIED',
  latest_confirmed_at: CONFIRMED_AT,
  checked_at: '2026-08-15T05:00:00Z',
  tasks: [
    {
      terraform_task_name: 'vpc-peering',
      state: 'APPLIED',
      terraform_execution_side: 'PII_AGENT',
    },
  ],
});

const mount = () =>
  render(<ConfirmTab targetSourceId={1642} detail={CSP} processStatus="CONNECTED" onOpenInfra={vi.fn()} />);

describe('ConfirmTab 밴드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApprovalRequestLatest.mockResolvedValue({
      request: {
        requestId: 12,
        status: 'APPROVED',
        requestedBy: 'ops',
        requestedAt: '2026-08-10T05:00:00Z',
      },
      resources: [],
      verdict: { status: 'APPROVED', processedBy: 'admin', processedAt: '2026-08-11T05:00:00Z' },
    });
    getConfirmedIntegration.mockResolvedValue({
      resource_infos: [confirmedRow(0), confirmedRow(1)],
    });
    getTerraformStatus.mockResolvedValue(terraformStatus());
  });

  it('축은 둘이다 — 설치 (Terraform) 칸은 없다', async () => {
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    expect(within(band).getAllByRole('tab')).toHaveLength(2);
    expect(within(band).getByRole('tab', { name: /연동 요청 확인/ })).toBeTruthy();
    expect(within(band).getByRole('tab', { name: /확정 정보/ })).toBeTruthy();
    expect(within(band).queryByRole('tab', { name: /설치/ })).toBeNull();
  });

  it('Terraform 어휘가 화면 어디에도 없다', async () => {
    const { container } = mount();

    await screen.findByRole('tablist', { name: '확정 정보 축' });
    // 응답에는 overall_state·task 가 실려 있는데도 — 그 축은 인프라 작업 탭이 소유한다.
    expect(container.textContent).not.toContain('Terraform');
    expect(screen.queryByText('vpc-peering')).toBeNull();
  });

  it('확정 시각이 확정 정보 칸과 pane 에 닿는다 — 이 콜이 남은 유일한 이유', async () => {
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    expect(within(band).getByRole('tab', { name: /확정 정보/ }).textContent).toContain(
      '리소스 2건 · 08-14',
    );
    // 기본 선택 칸은 확정 정보다 — pane 머리가 같은 시각을 전체 형태로 다시 말한다.
    expect(screen.getByText(/리소스 2건 · 2026-08-14 14:00 등록/)).toBeTruthy();
    expect(getTerraformStatus).toHaveBeenCalledWith(1642);
  });

  it('terraform 조회가 실패하면 배너 대신 그 칸이 무엇이 없는지 말한다', async () => {
    getTerraformStatus.mockRejectedValue(new Error('boom'));
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    const confirmCell = within(band).getByRole('tab', { name: /확정 정보/ });
    // 잃는 것은 날짜 한 칸이라 배너를 올리지 않는다.
    expect(confirmCell.textContent).toContain('리소스 2건');
    expect(screen.queryByText('일부 정보를 불러오지 못했습니다.')).toBeNull();
    // 그렇다고 침묵하지도 않는다 — `리소스 2건` 만 남으면 "시각 없는 확정"과 구분이 안 된다.
    expect(confirmCell.textContent).toContain('확정 시각 불러오지 못함');
  });

  it('요청 조회가 실패하면 오류 배너를 올린다', async () => {
    getApprovalRequestLatest.mockRejectedValue(new Error('boom'));
    mount();

    expect(await screen.findByText('일부 정보를 불러오지 못했습니다.')).toBeTruthy();
  });
});
