import type { CloudProvider } from '@/lib/types';

/**
 * One public fact about the cloud account that a TargetSource points to — AWS 계정 and
 * its two roles, Azure Subscription/Tenant ID, GCP Project ID, etc. Distinct from the
 * SecretKey credential. The header prints one per cell of its kv grid.
 */
export interface TargetSourceIdentifier {
  label: string;
  value: string | null;
  /**
   * Short form to PRINT. `value` stays the whole string — it is what the copy button
   * writes and what the cell's `title` spells out — so a role ARN can read as its role
   * name in a 240px cell without the evidence leaving the screen (`awsRoleArnDisplay`,
   * the rule the ops strip already uses). Omit it and the value prints whole.
   */
  display?: string;
  /**
   * What the cell says when there is no value: 「미등록」, 「역할 불필요」. A cell with
   * neither a value nor this drops out entirely — an absent identifier must not render
   * "-" (결정 #49) — but a cell that VANISHES makes "there is none" and "not read yet"
   * look the same, so a fact we positively know to be absent says so instead
   * (오너 2026-08-28).
   */
  emptyText?: string;
  /** `title` on `emptyText`, explaining WHY there is nothing here. */
  emptyHint?: string;
  /** When true, render the value with mono font and reveal a copy button on hover. */
  mono?: boolean;
}

export interface ProjectIdentity {
  cloudProvider: CloudProvider;
  /** Provider-specific public identifiers (account id, subscription id, tenant id, project id, ...). */
  identifiers: TargetSourceIdentifier[];
  /**
   * AWS 설치 모드 (metadata.grant_service_terraform_execution_permission).
   * auto = BDC installs via delegated Terraform, manual = the customer runs the
   * install script. Omitted when the provider has no such concept — the header
   * hides the row entirely.
   */
  installMode?: 'auto' | 'manual';
}
