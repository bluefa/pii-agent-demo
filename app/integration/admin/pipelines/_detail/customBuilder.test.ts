import { describe, expect, it } from 'vitest';
import {
  availableEntries,
  canSubmit,
  dragTargetIndex,
  moveTask,
  reorderTask,
  toCustomRequest,
  wireProvider,
} from '@/app/integration/admin/pipelines/_detail/customBuilder';
import type { TaskCatalogEntry } from '@/lib/pipeline/types';

const entry = (name: string, kind: TaskCatalogEntry['kind'] = 'TERRAFORM_JOB'): TaskCatalogEntry => ({
  name,
  display_name: `표시명 ${name}`,
  description: `카탈로그 설명 ${name}`,
  provider: 'AWS',
  kind,
  consumes_terraform_slot: kind === 'TERRAFORM_JOB',
});

describe('wireProvider', () => {
  it('maps the four orchestrator providers from providerKey casing', () => {
    expect(wireProvider('aws')).toBe('AWS');
    expect(wireProvider('gcp')).toBe('GCP');
    expect(wireProvider('azure')).toBe('AZURE');
    expect(wireProvider('idc')).toBe('IDC');
  });

  it('returns null for providers outside the orchestrator enum (e.g. sdu)', () => {
    expect(wireProvider('sdu')).toBeNull();
    expect(wireProvider('')).toBeNull();
  });
});

describe('availableEntries', () => {
  it('hides already-chosen names (UI dedup)', () => {
    const catalog = [entry('A'), entry('B'), entry('C')];
    expect(availableEntries(catalog, [catalog[1]]).map((e) => e.name)).toEqual(['A', 'C']);
  });

  it('returns the full catalog when nothing is chosen', () => {
    const catalog = [entry('A'), entry('B')];
    expect(availableEntries(catalog, [])).toHaveLength(2);
  });
});

describe('moveTask', () => {
  const list = [entry('A'), entry('B'), entry('C')];

  it('swaps with the neighbor in the given direction', () => {
    expect(moveTask(list, 1, -1).map((t) => t.name)).toEqual(['B', 'A', 'C']);
    expect(moveTask(list, 1, 1).map((t) => t.name)).toEqual(['A', 'C', 'B']);
  });

  it('is a no-op (same reference) at the edges', () => {
    expect(moveTask(list, 0, -1)).toBe(list);
    expect(moveTask(list, 2, 1)).toBe(list);
  });

  it('does not mutate the input', () => {
    moveTask(list, 0, 1);
    expect(list.map((t) => t.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('reorderTask', () => {
  const list = [entry('A'), entry('B'), entry('C'), entry('D')];

  it('moves an item across multiple slots in either direction', () => {
    expect(reorderTask(list, 0, 2).map((t) => t.name)).toEqual(['B', 'C', 'A', 'D']);
    expect(reorderTask(list, 3, 1).map((t) => t.name)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('is a no-op (same reference) for same-slot or out-of-range moves', () => {
    expect(reorderTask(list, 1, 1)).toBe(list);
    expect(reorderTask(list, -1, 2)).toBe(list);
    expect(reorderTask(list, 0, 4)).toBe(list);
  });

  it('does not mutate the input', () => {
    reorderTask(list, 0, 3);
    expect(list.map((t) => t.name)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('dragTargetIndex', () => {
  it('rounds the displacement to whole slots (half a step flips the slot)', () => {
    expect(dragTargetIndex(1, 0, 186, 4)).toBe(1);
    expect(dragTargetIndex(1, 92, 186, 4)).toBe(1); // < half step
    expect(dragTargetIndex(1, 94, 186, 4)).toBe(2); // ≥ half step
    expect(dragTargetIndex(1, -200, 186, 4)).toBe(0);
    expect(dragTargetIndex(0, 400, 186, 4)).toBe(2);
  });

  it('clamps to the list bounds and ignores a non-positive step', () => {
    expect(dragTargetIndex(0, -500, 186, 4)).toBe(0);
    expect(dragTargetIndex(3, 900, 186, 4)).toBe(3);
    expect(dragTargetIndex(2, 500, 0, 4)).toBe(2);
  });
});

describe('canSubmit', () => {
  it('requires at least one task', () => {
    expect(canSubmit([])).toBe(false);
    expect(canSubmit([entry('A')])).toBe(true);
  });
});

describe('toCustomRequest', () => {
  it('sends names only, order preserved — never a description (owner call)', () => {
    const body = toCustomRequest([entry('B'), entry('A')]);
    expect(body).toEqual({ tasks: [{ name: 'B' }, { name: 'A' }] });
  });
});
