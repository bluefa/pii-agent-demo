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

describe('AzureInstallationInline — master-detail step nav', () => {
  it('renders the four Azure steps with 서비스측/BDC측 side tags', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    // 설치 순서대로. 제목은 계약 필드가 말하는 만큼만 — 특정 리소스(KeyVault,
    // Load Balancer)를 지목하던 프로토타입 문구는 계약에 근거가 없어 걷어냈다.
    expect(within(nav).getByText('VM Subnet 생성')).toBeTruthy();
    expect(within(nav).getByText('VM Terraform 적용')).toBeTruthy();
    expect(within(nav).getByText('BDC측 Terraform 적용')).toBeTruthy();
    expect(within(nav).getByText('Private Endpoint 승인')).toBeTruthy();
    // 주체 태그: 서비스측 승인 1 + 서비스측 리소스 생성 2 + BDC측 리소스 생성 1.
    expect(within(nav).getAllByText('서비스측 리소스 생성').length).toBe(2);
    expect(within(nav).getByText('BDC측 리소스 생성')).toBeTruthy();
  });

  it('opens the summary with the PE step as the service-side action item', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    // PE carries serviceAction and is unsettled → summary is the default view
    // and the step lands in the "확인이 필요합니다" group, not the table.
    expect(screen.getAllByText(/Private Endpoint 연결을 승인해 주세요/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Azure Portal에서 승인 필요')).toBeNull();
  });

  it('opening the PE step from the summary renders the domain pill labels', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    fireEvent.click(screen.getByRole('button', { name: '해당 단계 열기 →' }));
    // The pending VM row shows the PE wording, the DB row shows 승인 완료.
    expect(screen.getByText('Azure Portal에서 승인 필요')).toBeTruthy();
    expect(screen.getByText('승인 완료')).toBeTruthy();
  });

  it('renders 해당 없음 for non-VM resources on VM-only steps (SKIP)', () => {
    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    // VM steps aggregate 2/2 (COMPLETED + SKIP both settle).
    expect(within(nav).getAllByText('2/2').length).toBeGreaterThanOrEqual(2);
  });
});
