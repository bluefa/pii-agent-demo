import { describe, it, expect } from 'vitest';
import {
  abbrevMiddle,
  buildLogicalDbTree,
  isDenyish,
  listStagedChanges,
  logicalDbRowStatus,
  logicalDbUnit,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-tree';
import type { LogicalDatabase } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

const db = (name: string, extra: Partial<LogicalDatabase> = {}): LogicalDatabase => ({
  id: name,
  name,
  type: 'db',
  database: name,
  ...extra,
});

const sch = (database: string, schema: string, extra: Partial<LogicalDatabase> = {}): LogicalDatabase => ({
  id: `${database}.${schema}`,
  name: `${database}.${schema}`,
  type: 'schema',
  database,
  schema,
  ...extra,
});

describe('buildLogicalDbTree', () => {
  it('groups schema rows under their database row, preserving order', () => {
    const tree = buildLogicalDbTree([
      db('live', { virtual: true }),
      sch('live', 'public'),
      sch('live', 'analytics'),
      db('stg'),
    ]);
    expect(tree.nodes.map((n) => n.row.database)).toEqual(['live', 'stg']);
    expect(tree.nodes[0].children.map((c) => c.schema)).toEqual(['public', 'analytics']);
    expect(tree.hasSchemaUnit).toBe(true);
  });

  it('synthesizes a placeholder parent when a schema row has no database row', () => {
    const tree = buildLogicalDbTree([sch('orphan', 'public')]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].row).toMatchObject({ type: 'db', database: 'orphan', virtual: true });
  });

  it('a later real database row replaces the placeholder', () => {
    const tree = buildLogicalDbTree([sch('live', 'public'), db('live')]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].row.virtual).toBeUndefined();
    expect(tree.nodes[0].children).toHaveLength(1);
  });

  it('a flat database-only list reports hasSchemaUnit=false', () => {
    const tree = buildLogicalDbTree([db('live'), db('stg')]);
    expect(tree.hasSchemaUnit).toBe(false);
    expect(tree.nodes.every((n) => n.children.length === 0)).toBe(true);
  });
});

describe('logicalDbUnit', () => {
  it('judges schema unit from a tested schema row', () => {
    expect(logicalDbUnit([db('live', { virtual: true }), sch('live', 'public')])).toBe('schema');
  });

  it('judges database unit from tested DATABASE rows only', () => {
    expect(logicalDbUnit([db('live'), db('stg')])).toBe('database');
  });

  it('ignores policy-only (untested) rows — the skip list must never drive the unit', () => {
    // Untested schema row must not flip a DATABASE-unit target to schema.
    expect(logicalDbUnit([db('live'), sch('legacy', 'old', { untested: true })])).toBe('database');
    // Nothing tested at all → no judgment, even with policy rows present.
    expect(logicalDbUnit([db('legacy', { untested: true })])).toBe(null);
  });

  it('returns null for an empty list', () => {
    expect(logicalDbUnit([])).toBe(null);
  });
});

describe('logicalDbRowStatus', () => {
  const initial = new Set(['prd', 'live.temp']);

  it('classifies the four membership combinations', () => {
    const current = new Set(['prd', 'stg']); // live.temp restored, stg newly excluded
    expect(logicalDbRowStatus('prd', undefined, current, initial)).toBe('deny');
    expect(logicalDbRowStatus('stg', undefined, current, initial)).toBe('staged-exclude');
    expect(logicalDbRowStatus('live.temp', 'live', current, initial)).toBe('staged-restore');
    expect(logicalDbRowStatus('live.public', 'live', current, initial)).toBe('allow');
  });

  it('a child of a currently-excluded parent is inherited regardless of its own membership', () => {
    const current = new Set(['live', 'live.temp']);
    expect(logicalDbRowStatus('live.temp', 'live', current, initial)).toBe('inherited');
    expect(logicalDbRowStatus('live.public', 'live', current, initial)).toBe('inherited');
  });

  it('isDenyish covers deny / staged-exclude / inherited only', () => {
    expect(isDenyish('deny')).toBe(true);
    expect(isDenyish('staged-exclude')).toBe(true);
    expect(isDenyish('inherited')).toBe(true);
    expect(isDenyish('allow')).toBe(false);
    expect(isDenyish('staged-restore')).toBe(false);
  });
});

describe('abbrevMiddle', () => {
  it('keeps head and tail of a long name', () => {
    expect(abbrevMiddle('svc_payment_settlement_20250110_archive_replica', 16, 12)).toBe(
      'svc_payment_sett…hive_replica',
    );
  });

  it('returns short names untouched', () => {
    expect(abbrevMiddle('short_name', 16, 12)).toBe('short_name');
  });
});

describe('listStagedChanges', () => {
  it('lists exclude/restore diffs in databases order', () => {
    const databases = [db('live'), db('stg'), db('prd')];
    const initial = { excludedIds: new Set(['prd']), reasons: { prd: 'TEMP' as const } };
    const draft = { excludedIds: new Set(['stg']), reasons: { stg: 'STG' as const } };
    expect(listStagedChanges(databases, draft, initial)).toEqual([
      { id: 'stg', name: 'stg', action: 'exclude' },
      { id: 'prd', name: 'prd', action: 'restore' },
    ]);
  });

  it('returns empty when the draft equals the saved state', () => {
    const databases = [db('prd')];
    const initial = { excludedIds: new Set(['prd']), reasons: { prd: 'TEMP' as const } };
    expect(listStagedChanges(databases, initial, initial)).toEqual([]);
  });
});
