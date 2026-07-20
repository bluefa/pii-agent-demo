/**
 * P3 NLB assignment draft state (pure) — the admin edits each IDC resource's NLB
 * index locally; a per-row 저장 button commits one change (api-spec G5). Draft is
 * keyed by resource_id (the internal NLB PUT key). A choice equal to the row's
 * original index is NOT dirty (removed from the draft) so the 저장 button and the
 * approve-modal "미저장 변경" warning stay honest.
 */
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
// NLB thresholds have a single definition in the shared occupancy bits. Import
// the capacity for nlbOptionDisabled and re-export both so this layer and
// IdcResourceTable read the same 30 주의 / 50 Hard Limit rule (api-spec G2).
import { NLB_CAPACITY } from '@/app/admin/pipelines/queue/_components/bits';

export { NLB_CAPACITY, NLB_WARN_THRESHOLD } from '@/app/admin/pipelines/queue/_components/bits';

/** resource_id → drafted NLB index (only present when it differs from original). */
export type NlbDraft = Readonly<Record<string, number>>;

/** The index the row currently shows — draft override, else the original. */
export function effectiveNlbIndex(row: RequestResourceRow, draft: NlbDraft): number | null {
  if (row.resourceId != null && row.resourceId in draft) return draft[row.resourceId];
  return row.nlbIndex;
}

/** A row is dirty when its draft index differs from the row's original index. */
export function isNlbDirty(row: RequestResourceRow, draft: NlbDraft): boolean {
  return (
    row.resourceId != null &&
    row.resourceId in draft &&
    draft[row.resourceId] !== row.nlbIndex
  );
}

/** Set (or clear, when chosen === original) a row's drafted index. */
export function setNlbDraft(
  draft: NlbDraft,
  row: RequestResourceRow,
  chosen: number,
): NlbDraft {
  if (row.resourceId == null) return draft;
  const next = { ...draft };
  if (chosen === row.nlbIndex) delete next[row.resourceId];
  else next[row.resourceId] = chosen;
  return next;
}

/** Drop a row's draft (after a successful save, so it re-baselines). */
export function clearNlbDraft(draft: NlbDraft, resourceId: string): NlbDraft {
  if (!(resourceId in draft)) return draft;
  const next = { ...draft };
  delete next[resourceId];
  return next;
}

/** Count of rows with an unsaved NLB change (approve-modal warning). */
export function dirtyCount(rows: readonly RequestResourceRow[], draft: NlbDraft): number {
  return rows.filter((row) => isNlbDirty(row, draft)).length;
}

/** A Hard-Limit (≥50) NLB can't take a new assignment — its option is disabled,
 *  UNLESS it is the row's current index (so the current value stays selectable). */
export function nlbOptionDisabled(
  occupied: number,
  optionIndex: number,
  currentIndex: number | null,
): boolean {
  return occupied >= NLB_CAPACITY && optionIndex !== currentIndex;
}
