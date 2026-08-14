import { describe, expect, it } from 'vitest';
import { pickScanPrincipal } from '@/lib/target-source-response';

/**
 * 세 키가 같은 것을 말하므로 ?? 로 이어 붙이고 싶어진다 — 그러면 GCP 대상에
 * aws_scan_role_arn 이 남아 있을 때 AWS 의 주체를 GCP 화면이 자기 것처럼 그린다.
 * 읽을 키는 프로바이더가 정한다는 규칙을 여기서 잠근다.
 */
describe('pickScanPrincipal', () => {
  const metadata = {
    aws_scan_role_arn: 'arn:aws:iam::123456789012:role/BDCPIIInfraScanRole',
    gcp_scan_service_account: 'pii-agent-scan@proj.iam.gserviceaccount.com',
    azure_scan_app_id: '1b6e0e0c-9f21-4c7e-8a4d-000000000001',
  };

  it('프로바이더가 읽을 키를 정한다', () => {
    expect(pickScanPrincipal(metadata, 'AWS')).toBe(metadata.aws_scan_role_arn);
    expect(pickScanPrincipal(metadata, 'GCP')).toBe(metadata.gcp_scan_service_account);
    expect(pickScanPrincipal(metadata, 'Azure')).toBe(metadata.azure_scan_app_id);
  });

  it('다른 프로바이더의 값은 새어 들어오지 않는다', () => {
    expect(pickScanPrincipal({ aws_scan_role_arn: metadata.aws_scan_role_arn }, 'GCP')).toBeUndefined();
  });

  it('IDC·미등록·빈 문자열은 주체가 없다', () => {
    expect(pickScanPrincipal(metadata, 'IDC')).toBeUndefined();
    expect(pickScanPrincipal(null, 'AWS')).toBeUndefined();
    expect(pickScanPrincipal({ aws_scan_role_arn: '  ' }, 'AWS')).toBeUndefined();
  });
});
