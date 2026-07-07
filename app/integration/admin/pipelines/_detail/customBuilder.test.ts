import { describe, expect, it } from 'vitest';
import {
  availableEntries,
  canSubmit,
  descriptionTooLong,
  moveTask,
  toCustomRequest,
  wireProvider,
  MAX_DESCRIPTION_LENGTH,
  type BuilderTask,
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

const task = (name: string, description = ''): BuilderTask => ({ entry: entry(name), description });

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
    const chosen = [task('B')];
    expect(availableEntries(catalog, chosen).map((e) => e.name)).toEqual(['A', 'C']);
  });

  it('returns the full catalog when nothing is chosen', () => {
    const catalog = [entry('A'), entry('B')];
    expect(availableEntries(catalog, [])).toHaveLength(2);
  });
});

describe('moveTask', () => {
  const list = [task('A'), task('B'), task('C')];

  it('swaps with the neighbor in the given direction', () => {
    expect(moveTask(list, 1, -1).map((t) => t.entry.name)).toEqual(['B', 'A', 'C']);
    expect(moveTask(list, 1, 1).map((t) => t.entry.name)).toEqual(['A', 'C', 'B']);
  });

  it('is a no-op (same reference) at the edges', () => {
    expect(moveTask(list, 0, -1)).toBe(list);
    expect(moveTask(list, 2, 1)).toBe(list);
  });

  it('does not mutate the input', () => {
    moveTask(list, 0, 1);
    expect(list.map((t) => t.entry.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('canSubmit / descriptionTooLong', () => {
  it('blocks an empty list', () => {
    expect(canSubmit([])).toBe(false);
  });

  it('allows descriptions at exactly 100 chars, blocks 101', () => {
    const at100 = task('A', 'x'.repeat(MAX_DESCRIPTION_LENGTH));
    const at101 = task('B', 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1));
    expect(descriptionTooLong(at100)).toBe(false);
    expect(descriptionTooLong(at101)).toBe(true);
    expect(canSubmit([at100])).toBe(true);
    expect(canSubmit([at100, at101])).toBe(false);
  });
});

describe('toCustomRequest', () => {
  it('preserves order and omits blank descriptions', () => {
    const body = toCustomRequest([task('B', '  '), task('A', '재시도 목적')]);
    expect(body).toEqual({
      tasks: [{ name: 'B' }, { name: 'A', description: '재시도 목적' }],
    });
  });
});
