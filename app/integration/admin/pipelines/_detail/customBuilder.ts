/**
 * Custom-recipe builder logic (LIN-22 §B2). Pure functions over the chosen
 * task list so ordering / validation / request assembly are unit-testable
 * apart from the modal. Wire contract is LIN-18 (A2):
 * `POST …/pipelines/custom {tasks:[{name, description?}]}` — array order is
 * the execution order, description is optional and capped at 100 chars, and
 * names resolve against the TaskDefinition catalog (#12).
 */
import type { CloudProvider, CustomPipelineRequest, TaskCatalogEntry } from '@/lib/pipeline/types';

export const MAX_DESCRIPTION_LENGTH = 100;

/** One builder row — the catalog entry it references + the operator note. */
export interface BuilderTask {
  entry: TaskCatalogEntry;
  description: string;
}

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
  chosen: readonly BuilderTask[],
): TaskCatalogEntry[] {
  const used = new Set(chosen.map((t) => t.entry.name));
  return catalog.filter((e) => !used.has(e.name));
}

/** Move the row at `index` one slot up (-1) / down (+1); no-op (same array) at the edges. */
export function moveTask(list: BuilderTask[], index: number, dir: -1 | 1): BuilderTask[] {
  return reorderTask(list, index, index + dir);
}

/** Move the row at `from` to slot `to` (drag drop); no-op (same array) when out of range or equal. */
export function reorderTask(list: BuilderTask[], from: number, to: number): BuilderTask[] {
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

export function descriptionTooLong(task: BuilderTask): boolean {
  return task.description.length > MAX_DESCRIPTION_LENGTH;
}

/** Run gating (AC): at least one task AND every description within 100 chars. */
export function canSubmit(list: readonly BuilderTask[]): boolean {
  return list.length > 0 && !list.some(descriptionTooLong);
}

/** Assemble the LIN-18 request body — blank descriptions are omitted, order preserved. */
export function toCustomRequest(list: readonly BuilderTask[]): CustomPipelineRequest {
  return {
    tasks: list.map((t) => {
      const description = t.description.trim();
      return description ? { name: t.entry.name, description } : { name: t.entry.name };
    }),
  };
}
