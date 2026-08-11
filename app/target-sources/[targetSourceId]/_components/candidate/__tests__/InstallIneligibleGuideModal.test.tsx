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
    open('AZURE_RESOURCE_VNET_INTEGRATED_MODE');
    // 원인은 배포 방식으로 말한다 — "연결에 실패했다"는 다시 시도하면 될 것처럼 읽혔다.
    expect(
      screen.getByText(/VNet Integration.*방식으로 배포된 리소스에는 Private Endpoint를 설치할 수 없어요/),
    ).toBeTruthy();
    expect(screen.getByText(/네트워킹 모드는 서버를 만들 때 정해지고/)).toBeTruthy();
    expect(screen.getByText(/새 서버를 만든 뒤 데이터를 옮기면/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Azure VNet 네트워킹 문서' })).toBeTruthy();
  });

  // Both GCP values are PSC prerequisites the instance fails, so each one names PSC and
  // links Google's own doc — never Azure's story.
  it.each([
    ['GCP_CLOUD_SQL_HAS_PUBLIC_IP', /공인 IP가 설정되어 있어/],
    ['GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET', /내부 HTTP 로드밸런서용 서브넷/],
  ] as const)('explains %s as a PSC prerequisite', (reason, cause) => {
    open(reason);
    expect(screen.getByText(cause)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Private Service Connect/ })).toBeTruthy();
    expect(screen.queryByText(/Private Endpoint/)).toBeNull();
  });

  // Clearing a public IP is a setting change; moving to a PSC-capable subnet means
  // migrating the instance. Only the first is small enough to recommend in one line.
  it('offers a remedy for the public IP', () => {
    open('GCP_CLOUD_SQL_HAS_PUBLIC_IP');
    expect(screen.getByText('조치 방법')).toBeTruthy();
    expect(screen.getByText(/공인 IP를 해제한 뒤/)).toBeTruthy();
  });

  it('states the subnet constraint without prescribing a migration', () => {
    open('GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET');
    expect(screen.queryByText('조치 방법')).toBeNull();
    // The constraint and where to ask about it still stand.
    expect(screen.getByRole('link', { name: /Private Service Connect/ })).toBeTruthy();
    expect(screen.getByText('협업 채널')).toBeTruthy();
  });

  it('falls back to the classification alone when no reason code was sent (AWS·IDC)', () => {
    open(null);
    expect(screen.getByText(/네트워크 구성 제약으로 Agent를 설치할 수 없는/)).toBeTruthy();
    expect(screen.queryByText(/Private Endpoint/)).toBeNull();
    // Nothing is known beyond the verdict, so the only next step is a person.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('협업 채널')).toBeTruthy();
  });
});
