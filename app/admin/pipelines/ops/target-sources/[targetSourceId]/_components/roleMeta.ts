/** Shared AWS role vocabulary for the ops page (edit modal + header rows). */
export type RoleKind = 'scan' | 'execution';

/**
 * `title` 은 **AWS 콘솔에서 찾을 이름**이라 영문 그대로다 — 모달이 여는 자리는 운영자가
 * 콘솔과 대조하는 자리다. `short` 는 kv 스트립의 **라벨**이라 한국어다 (오너 2026-08-27
 * "ScanRole도 그냥 gcp처럼 정리할래?"): 같은 줄의 GCP 주체 라벨이 「스캔 서비스 계정」·
 * 「테라폼 서비스 계정」이므로, 두 프로바이더의 권한 주체 행이 같은 문법으로 읽힌다.
 */
export const ROLE_META: Record<
  RoleKind,
  { title: string; short: string; sample: string; recommended: string[] }
> = {
  scan: {
    title: 'Scan Role',
    short: '스캔 역할',
    sample: 'BDCPIIInfraScanRole',
    // 자주 쓰는 이름 — 모달이 세로로 쌓이는 칩으로 그린다 (추가되면 여기만 늘린다).
    recommended: ['BDCPIIInfraScanRole', 'bdc-pii-infra-scan-role'],
  },
  execution: {
    title: 'Terraform Execution Role',
    short: '테라폼 역할',
    sample: 'bdc-infra-terraform-worker-service-role',
    recommended: ['bdc-infra-terraform-worker-service-role'],
  },
};
