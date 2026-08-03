/**
 * P3 NLB pure bits — the capacity rule the assignment modal enforces, and the lookup
 * that pairs one resource with its per-service NLB mappings.
 *
 * The draft reducer that used to live here is gone with the per-row select: the
 * assignment modal picks and saves in one act (see _useNlbAssignment), so there is no
 * intermediate dirty state to model.
 */
import type { NlbIndexMapping, ResourceNlbMappings } from '@/app/lib/api/task-queue-requests';
// NLB thresholds have a single definition in the shared occupancy bits. Import
// the capacity for nlbOptionDisabled and re-export both so this layer and the
// assignment modal read the same 30 주의 / 50 Hard Limit rule (api-spec G2).
import { NLB_CAPACITY } from '@/app/admin/pipelines/queue/_components/bits';

export { NLB_CAPACITY, NLB_WARN_THRESHOLD } from '@/app/admin/pipelines/queue/_components/bits';

/** A Hard-Limit (>=50) NLB can't take a new assignment — its row is unpickable,
 *  UNLESS it is the resource's current index (so the current value stays selectable). */
export function nlbOptionDisabled(
  occupied: number,
  optionIndex: number,
  currentIndex: number | null,
): boolean {
  return occupied >= NLB_CAPACITY && optionIndex !== currentIndex;
}

/** The resource's current NLB mappings, or null when unavailable — the fetch failed
 *  (`mappings === null`) or the row has no resource_id key. A resource absent from a
 *  successful fetch has no assignment yet -> [] (배정 없음), which is distinct from the
 *  null load-failure fallback. */
export function findResourceMappings(
  mappings: ResourceNlbMappings[] | null,
  resourceId: string | null,
): NlbIndexMapping[] | null {
  if (mappings === null || resourceId == null) return null;
  const entry = mappings.find((m) => m.resourceId === resourceId);
  return entry ? entry.mappings : [];
}
