/**
 * Custom-recipe builder logic (LIN-22 §B2). Pure functions over the chosen
 * task list so ordering / gating / request assembly are unit-testable apart
 * from the modal. Wire contract is LIN-18 (A2):
 * `POST …/pipelines/custom {tasks:[{name}]}` — array order is the execution
 * order and names resolve against the TaskDefinition catalog (#12). The wire
 * `description` field exists but is optional and the builder never sends it
 * (owner call, 2026-07-07: no per-task descriptions in the frontend).
 */
import type { CloudProvider, CustomPipelineRequest, TaskCatalogEntry } from '@/lib/pipeline/types';

/** providerKey ('aws'…) → orchestrator wire enum; null = custom unsupported (e.g. SDU). */
const WIRE_PROVIDERS: Record<string, CloudProvider> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'AZURE',
  idc: 'IDC',
};

export function wireProvider(providerKey: string): CloudProvider | null {
  return WIRE_PROVIDERS[providerKey] ?? null;
}

/** Catalog entries not yet chosen (UI dedup — re-running a task = remove then re-add). */
export function availableEntries(
  catalog: readonly TaskCatalogEntry[],
  chosen: readonly TaskCatalogEntry[],
): TaskCatalogEntry[] {
  const used = new Set(chosen.map((t) => t.name));
  return catalog.filter((e) => !used.has(e.name));
}

/** Move the item at `index` one slot up (-1) / down (+1); no-op (same array) at the edges. */
export function moveTask<T>(list: T[], index: number, dir: -1 | 1): T[] {
  return reorderTask(list, index, index + dir);
}

/** Move the item at `from` to slot `to` (drag drop); no-op (same array) when out of range or equal. */
export function reorderTask<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/**
 * Slot the dragged node should occupy given its horizontal displacement:
 * one slot per `step` (node width + connector), rounded, clamped to the list.
 */
export function dragTargetIndex(index: number, dx: number, step: number, length: number): number {
  if (step <= 0) return index;
  const target = index + Math.round(dx / step);
  return Math.max(0, Math.min(length - 1, target));
}

/** Run gating (AC): at least one task. */
export function canSubmit(list: readonly TaskCatalogEntry[]): boolean {
  return list.length > 0;
}

/** Assemble the LIN-18 request body — names only, order preserved. */
export function toCustomRequest(list: readonly TaskCatalogEntry[]): CustomPipelineRequest {
  return { tasks: list.map((e) => ({ name: e.name })) };
}
