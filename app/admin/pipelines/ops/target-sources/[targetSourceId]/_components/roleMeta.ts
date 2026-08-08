/** Shared AWS role vocabulary for the ops page (edit modal + header rows). */
export type RoleKind = 'scan' | 'execution';

export const ROLE_META: Record<
  RoleKind,
  { title: string; short: string; sample: string; recommended: string[] }
> = {
  scan: {
    title: 'Scan Role',
    short: 'Scan Role',
    sample: 'PIIAgentScanRole',
    // 자주 쓰는 이름 — 모달이 세로로 쌓이는 칩으로 그린다 (추가되면 여기만 늘린다).
    recommended: ['PIIAgentScanRole'],
  },
  execution: {
    title: 'Terraform Execution Role',
    short: 'TF Role',
    sample: 'PIIAgentTerraformExecRole',
    // 확정된 공용 이름이 아직 없다 — 정해지면 채운다 (빈 배열 = 칩 미노출).
    recommended: [],
  },
};
