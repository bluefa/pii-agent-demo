/** Shared AWS role vocabulary for the ops page (edit modal + header rows). */
export type RoleKind = 'scan' | 'execution';

export const ROLE_META: Record<
  RoleKind,
  { title: string; short: string; sample: string; recommended: string[] }
> = {
  scan: {
    title: 'Scan Role',
    short: 'Scan Role',
    sample: 'BDCPIIInfraScanRole',
    // 자주 쓰는 이름 — 모달이 세로로 쌓이는 칩으로 그린다 (추가되면 여기만 늘린다).
    recommended: ['BDCPIIInfraScanRole', 'bdc-pii-infra-scan-role'],
  },
  execution: {
    title: 'Terraform Execution Role',
    short: 'TF Role',
    sample: 'bdc-infra-terraform-worker-service-role',
    recommended: ['bdc-infra-terraform-worker-service-role'],
  },
};
