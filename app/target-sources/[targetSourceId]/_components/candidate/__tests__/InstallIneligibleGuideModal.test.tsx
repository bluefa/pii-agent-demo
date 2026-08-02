// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InstallIneligibleGuideModal } from '@/app/target-sources/[targetSourceId]/_components/candidate/InstallIneligibleGuideModal';
import type { RecommendFailReason } from '@/lib/types';

const open = (recommendFailReason: RecommendFailReason | null) =>
  render(
    <InstallIneligibleGuideModal isOpen onClose={() => {}} recommendFailReason={recommendFailReason} />,
  );

// The guide used to hardcode Azure's Private Endpoint story for every provider, so a
// GCP Cloud SQL row was told to migrate an Azure Flexible Server. Each reason gets its
// own copy, and only Azure's names Private Endpoint.
describe('InstallIneligibleGuideModal', () => {
  it('keeps the Azure background and remedy, not just the one-line cause', () => {
    open('AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED');
    expect(screen.getByText(/Private Endpoint 연결에 실패/)).toBeTruthy();
    expect(screen.getByText(/네트워킹 모드는 서버를 만들 때 정해지고/)).toBeTruthy();
    expect(screen.getByText(/새 서버를 만든 뒤 데이터를 옮기면/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Azure VNet 네트워킹 문서' })).toBeTruthy();
  });

  it.each([
    ['GCP_CLOUD_SQL_HAS_PUBLIC_IP', /공인 IP가 설정되어 있어/],
    ['GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET', /내부 HTTP 로드밸런서용 서브넷/],
  ] as const)('states the GCP fact for %s without Azure copy', (reason, cause) => {
    open(reason);
    expect(screen.getByText(cause)).toBeTruthy();
    expect(screen.queryByText(/Private Endpoint/)).toBeNull();
    // No CSP-documented fix exists for these, so the guide routes to a human
    // rather than inventing remediation for production infrastructure.
    expect(screen.getByText('협업 채널')).toBeTruthy();
    expect(screen.getByText(/문의해주세요/)).toBeTruthy();
  });

  it('falls back to the classification alone when no reason code was sent (AWS·IDC)', () => {
    open(null);
    expect(screen.getByText(/네트워크 구성 제약으로 Agent를 설치할 수 없는/)).toBeTruthy();
    expect(screen.queryByText(/Private Endpoint/)).toBeNull();
  });
});
