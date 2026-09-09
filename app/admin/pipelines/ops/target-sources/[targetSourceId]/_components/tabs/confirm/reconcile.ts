/**
 * The join behind the 확정 정보 tab's 판정 column — approved selection ∪ confirmed record.
 *
 * The contract never says which approval a confirmed record was built from, so this is a
 * comparison of two lists, not a lineage: it answers "is this resource on both sides", and
 * nothing about cause. Only rows the approval actually SELECTED take part — an excluded row
 * was never meant to be confirmed, so its absence is not a difference.
 *
 * The key is `resource_id` whenever both sides carry one. IDC is the exception the contract
 * forces: its confirmed rows may arrive without a resource id (it is an internal NLB key,
 * optional in `ResourceConfigDto`), and there the identity IS the endpoint — the connect
 * targets plus the port, the same pair every IDC table prints as the row's name.
 *
 * Computability is the CALLER's judgment (there has to be an approved request, and both loads
 * have to be ready). This module is only reached once that is settled.
 */
import type { ReconcileVerdict } from '@/lib/types/reconcile';

/** The minimum a row must show to be keyed. Both sides of both providers satisfy it. */
export interface ReconcileKeyed {
  resourceId: string | null;
  /** IDC only — ips (IP mode) or [host] (HOST mode). */
  connectTargets?: readonly string[];
  /** IDC only. */
  port?: number | null;
}

/**
 * Sorted, because the two sides list one host set in the order their own payload happened to
 * use, and a reordered array is the same endpoint.
 */
export function reconcileKey(row: ReconcileKeyed): string {
  const id = row.resourceId?.trim();
  if (id) return `id:${id}`;
  return `addr:${[...(row.connectTargets ?? [])].sort().join(',')}:${row.port ?? ''}`;
}

/**
 * A union, not two nullable fields: every row HAS at least one side, and a shape that admits
 * "neither" makes the renderer write a branch for a row that cannot exist.
 *
 * Each arm names its verdict through `ReconcileVerdict` rather than a bare literal, so the
 * shared vocabulary stays the one place a member can be renamed.
 */
export type ReconcileRow<A, C> =
  | { key: string; verdict: Extract<ReconcileVerdict, 'match'>; approved: A; confirmed: C }
  | { key: string; verdict: Extract<ReconcileVerdict, 'missingConfirmed'>; approved: A; confirmed: null }
  | { key: string; verdict: Extract<ReconcileVerdict, 'missingApproved'>; approved: null; confirmed: C };

export interface Reconcile<A, C> {
  /** Approval order first, then the confirmed rows the approval never named. */
  rows: ReconcileRow<A, C>[];
  missingConfirmed: number;
  missingApproved: number;
  /** The one number the headline and the 대조 rows count. */
  diffCount: number;
}

/**
 * @param approved every resource of the approved request — the filter to `selected` is here,
 *   so no caller can forget it.
 * @param confirmed the confirmed record's rows.
 */
export function reconcileResources<A extends ReconcileKeyed & { selected: boolean }, C extends ReconcileKeyed>(
  approved: readonly A[],
  confirmed: readonly C[],
): Reconcile<A, C> {
  // A queue per key, not one row: two rows can key alike (an IDC endpoint listed twice, an
  // id-less pair), and a Map that overwrites would silently drop one from the table.
  const pending = new Map<string, C[]>();
  for (const row of confirmed) {
    const key = reconcileKey(row);
    const bucket = pending.get(key);
    if (bucket) bucket.push(row);
    else pending.set(key, [row]);
  }

  const rows: ReconcileRow<A, C>[] = [];
  let missingConfirmed = 0;
  for (const row of approved) {
    if (!row.selected) continue;
    const key = reconcileKey(row);
    const match = pending.get(key)?.shift() ?? null;
    if (match == null) missingConfirmed += 1;
    rows.push(
      match
        ? { key, verdict: 'match', approved: row, confirmed: match }
        : { key, verdict: 'missingConfirmed', approved: row, confirmed: null },
    );
  }

  let missingApproved = 0;
  // Whatever the approval never claimed, in the confirmed record's own order.
  for (const row of confirmed) {
    const key = reconcileKey(row);
    const bucket = pending.get(key);
    if (!bucket?.length || !bucket.includes(row)) continue;
    bucket.splice(bucket.indexOf(row), 1);
    missingApproved += 1;
    rows.push({ key, verdict: 'missingApproved', approved: null, confirmed: row });
  }

  return { rows, missingConfirmed, missingApproved, diffCount: missingConfirmed + missingApproved };
}
