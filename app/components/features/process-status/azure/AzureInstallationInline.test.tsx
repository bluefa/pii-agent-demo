// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';

// A VM whose subnet + terraform apply are done but whose private endpoint is
// still pending approval, plus a DB resource (VM steps → SKIP).
const installDetail: AzureInstallDetail = {
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-07-30T10:00:00Z' },
  resources: [
    {
      resourceId: 'vm-1',
      resourceName: 'vm-1',
      rollup: { status: 'IN_PROGRESS', guide: null },
      cells: {
        pe: { status: 'IN_PROGRESS', label: 'Azure Portal에서 승인 필요', guide: null },
        vmSubnet: { status: 'COMPLETED', guide: null },
        vmApply: { status: 'COMPLETED', guide: null },
        bdc: { status: 'COMPLETED', guide: null },
      },
    },
    {
      resourceId: 'db-1',
      resourceName: 'db-1',
      rollup: { status: 'COMPLETED', guide: null },
      cells: {
        pe: { status: 'COMPLETED', label: '승인 완료', guide: null },
        vmSubnet: { status: 'SKIP', guide: null },
        vmApply: { status: 'SKIP', guide: null },
        bdc: { status: 'COMPLETED', guide: null },
      },
    },
  ],
};

vi.mock('@/app/hooks/useInstallationStatus', () => ({
  useInstallationStatus: () => ({
    status: installDetail,
    loading: false,
    refreshing: false,
    error: null,
    fetchStatus: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/lib/api/azure', () => ({
  getAzureInstallationStatus: vi.fn(),
}));

import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';

const confirmed: readonly ConfirmedResource[] = [
  {
    resourceId: 'vm-1',
    type: 'AZURE_VM',
    databaseType: 'AZURE_MYSQL',
    region: 'ap-northeast-1',
    resourceName: 'vm-1',
    host: null,
    port: null,
    oracleServiceId: null,
    networkInterfaceId: null,
    ipConfigurationName: null,
    credentialId: 'Key1',
    connectionStatus: 'CONNECTED',
  },
];

describe('AzureInstallationInline — 그룹 레일', () => {
  it('네 단계를 실행 주체 그룹으로 나눠 세운다', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    // 설치 순서대로. 제목은 계약 필드가 말하는 만큼만 — 특정 리소스(KeyVault,
    // Load Balancer)를 지목하던 프로토타입 문구는 계약에 근거가 없어 걷어냈다.
    expect(within(nav).getByText('VM Subnet 생성')).toBeTruthy();
    expect(within(nav).getByText('VM Terraform 적용')).toBeTruthy();
    expect(within(nav).getByText('BDC측 Terraform 적용')).toBeTruthy();
    expect(within(nav).getByText('Private Endpoint 승인')).toBeTruthy();
    // 주체는 그룹 머리글이 말한다 — 항목마다 붙던 side 태그는 사라졌다.
    expect(within(nav).queryByText('서비스측')).toBeNull();
    expect(within(nav).queryByText('BDC측')).toBeNull();
    // 서비스 측 셋 중 열려 있는 것은 PE 하나뿐(Subnet·Apply 는 COMPLETED).
    expect(within(nav).getByText('내가 할 일 (1)')).toBeTruthy();
    expect(within(nav).getByText('BDC 진행')).toBeTruthy();
    // BDC 그룹은 하나뿐이라 순번도 1 에서 끝난다 — 서비스 단계가 섞여 들어오면 깨진다.
    expect(within(nav).getByText('1')).toBeTruthy();
    expect(within(nav).queryByText('2')).toBeNull();
  });

  it('열린 할 일이 PE 하나면 그 단계가 기본 화면이다', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    const pe = within(nav).getByText('Private Endpoint 승인').closest('button')!;
    expect(pe.getAttribute('aria-current')).toBe('true');
    // 기본 화면이 곧 PE 단계 표라서 도메인 라벨이 바로 보인다: 대기 중인 VM 행은
    // PE 문구, 완료된 DB 행은 승인 완료.
    expect(screen.getByText('Azure Portal에서 승인 필요')).toBeTruthy();
    expect(screen.getByText('승인 완료')).toBeTruthy();
    // 그룹 레일에는 요약 패널이 없어 serviceAction("…승인해 주세요")이 그려지지
    // 않는다. 무엇을 해야 하는지는 이제 이 desc 한 줄이 전부이므로, 지운 단언
    // 대신 이 줄을 고정한다 — 이것까지 사라지면 화면이 아무 말도 하지 않는다.
    expect(screen.getByText('BDC가 요청한 Private Endpoint 연결을 Azure Portal에서 승인하는 단계입니다.')).toBeTruthy();
  });

  it('VM 전용 단계를 열면 VM 아닌 리소스는 해당 없음으로 선다 (SKIP)', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    fireEvent.click(within(nav).getByText('VM Subnet 생성').closest('button')!);
    // COMPLETED + SKIP — 둘 다 settle 이므로 레일은 완료라 말하고, 표는 둘을 구분한다.
    expect(screen.getByText('해당 없음')).toBeTruthy();
  });
});
