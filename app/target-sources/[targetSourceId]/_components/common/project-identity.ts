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
  /**
   * Give this fact TWO grid tracks instead of one. ⛔ Set it from the value's length via
   * `widenLongValues`, never by hand on a chosen field — a hand-marked list rots the
   * first time a role is registered under a longer name.
   */
  wide?: boolean;
}

/**
 * Longest displayed string that fits one 240px track, in characters.
 *
 * Derived from measurement, not taste (browser, 2026-08-29, `scrollWidth` vs
 * `clientWidth` on the running app):
 *
 * | value | chars | needs | got | over |
 * |---|---|---|---|---|
 * | Azure Subscription/Tenant UUID | 36 | 280px | 217px | 63px |
 * | AWS `bdc-infra-terraform-worker-service-role` | 39 | 247px | 215px | 32px |
 *
 * A 240px track leaves ~215px for the value — the copy button and its gap take the
 * other ~23–25px. Per-character width runs 6.3px for a lowercase role name up to 7.8px
 * for a hex UUID, so the worst case fits 215 / 7.8 ≈ 27 characters. Anything longer
 * than 26 takes two tracks.
 *
 * ⛔ Re-derive this number if `factGrid`'s track max or the copy affordance changes;
 * it is a function of both.
 */
export const WIDE_CELL_MIN_CHARS = 27;

/**
 * Marks every fact whose printed string cannot fit one track. Measured on what the cell
 * actually PRINTS (`display ?? value`) — a role cell shows the role name, so widening it
 * on the full ARN's length would spend two tracks on a value nobody renders.
 *
 * Applied to the whole list rather than to named fields, so a field that grows past the
 * threshold gets its second track without anyone remembering to grant it.
 */
export const widenLongValues = (
  identifiers: TargetSourceIdentifier[],
): TargetSourceIdentifier[] =>
  identifiers.map((it) => {
    const printed = it.display ?? it.value ?? '';
    return printed.length >= WIDE_CELL_MIN_CHARS ? { ...it, wide: true } : it;
  });

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
