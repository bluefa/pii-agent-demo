import { describe, expect, it } from 'vitest';
import { pickScanPrincipal } from '@/lib/target-source-response';

/**
 * 계약은 스캔 주체를 프로바이더마다 다른 키로 선언한다(`TargetSourceMetadata`).
 * 세 키가 한 응답에 같이 실릴 수 있으므로 `??` 체인은 남의 자격을 제 것처럼 그린다 —
 * 고르는 건 프로바이더다.
 */
describe('pickScanPrincipal', () => {
  const metadata = {
    aws_scan_role_arn: 'arn:aws:iam::710293845611:role/BDCPIIInfraScanRole',
    gcp_scan_service_account: 'pii-agent-scan@pii-agent-prod-12345.iam.gserviceaccount.com',
    azure_scan_app_id: '1b6e0e0c-9f21-4c7e-8a4d-000000001030',
  };

  it('프로바이더가 키를 고른다 — 셋이 같이 실려도 서로를 빌리지 않는다', () => {
    expect(pickScanPrincipal('AWS', metadata)).toBe(metadata.aws_scan_role_arn);
    expect(pickScanPrincipal('GCP', metadata)).toBe(metadata.gcp_scan_service_account);
    expect(pickScanPrincipal('Azure', metadata)).toBe(metadata.azure_scan_app_id);
  });

  it('제 키가 없으면 형제 키로 대신하지 않는다', () => {
    expect(pickScanPrincipal('GCP', { aws_scan_role_arn: metadata.aws_scan_role_arn })).toBeUndefined();
  });

  it('IDC 는 클라우드 스캔이 없어 주체도 없다', () => {
    expect(pickScanPrincipal('IDC', metadata)).toBeUndefined();
  });

  it('metadata 부재·빈 문자열은 값이 아니다', () => {
    expect(pickScanPrincipal('AWS', null)).toBeUndefined();
    expect(pickScanPrincipal('AWS', { aws_scan_role_arn: '  ' })).toBeUndefined();
  });
});
