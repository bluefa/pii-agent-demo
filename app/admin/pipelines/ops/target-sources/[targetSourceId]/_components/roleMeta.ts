/** Shared AWS role vocabulary for the ops page (verify/edit modals + header rows). */
export type RoleKind = 'scan' | 'execution';

export const ROLE_META: Record<RoleKind, { title: string; short: string; sample: string }> = {
  scan: { title: 'Scan Role', short: 'Scan Role', sample: 'PIIAgentScanRole' },
  execution: { title: 'Terraform Execution Role', short: 'TF Role', sample: 'PIIAgentTerraformExecRole' },
};
