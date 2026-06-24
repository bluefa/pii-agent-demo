import { describe, it, expect } from 'vitest';
import {
  buildModalData,
  buildVisibleDenyRows,
  denyId,
  draftToExcludedItems,
  isAlreadyDeny,
  isParentDeny,
  toRenderRow,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import type {
  ExcludedLogicalDatabase,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';
import type { LogicalDatabase } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

// Mirrors the mock seed (lib/bff/mock/logical-db.ts) so the helpers are tested
// against the same fixture the live demo exercises.
const TESTED: TestedLogicalDatabase[] = [
  { databaseName: 'live', type: 'DATABASE' },
  { databaseName: 'live', schemaName: 'public', type: 'SCHEMA' },
  { databaseName: 'live', schemaName: 'analytics', type: 'SCHEMA' },
  { databaseName: 'prd', type: 'DATABASE' },
  { databaseName: 'prd', schemaName: 'temp', type: 'SCHEMA' },
  { databaseName: 'stg', type: 'DATABASE' },
  { databaseName: 'dev', type: 'DATABASE' },
  { databaseName: 'reporting', type: 'DATABASE' },
  { databaseName: 'reporting', schemaName: 'public', type: 'SCHEMA' },
];

const EXCLUDED: ExcludedLogicalDatabase[] = [
  { databaseName: 'stg', skipReason: 'STG', type: 'DATABASE' },
  { databaseName: 'dev', skipReason: 'DEV', type: 'DATABASE' },
  { databaseName: 'prd', schemaName: 'temp', skipReason: 'TEMP', type: 'SCHEMA' },
  { databaseName: 'legacy', skipReason: 'TEMP', type: 'DATABASE' }, // excluded-only
];

describe('denyId', () => {
  it('uses database for a DATABASE, database.schema for a SCHEMA', () => {
    expect(denyId({ database: 'live' })).toBe('live');
    expect(denyId({ database: 'live', schema: 'public' })).toBe('live.public');
  });
});

describe('toRenderRow', () => {
  it('maps wire type DATABASE/SCHEMA → db/schema and builds the id', () => {
    expect(toRenderRow({ databaseName: 'live', type: 'DATABASE' })).toEqual({
      id: 'live',
      name: 'live',
      type: 'db',
      database: 'live',
    });
    expect(toRenderRow({ databaseName: 'live', schemaName: 'public', type: 'SCHEMA' })).toEqual({
      id: 'live.public',
      name: 'live.public',
      type: 'schema',
      database: 'live',
      schema: 'public',
    });
  });

  it('drops a row with no databaseName', () => {
    expect(toRenderRow({ type: 'DATABASE' })).toBeUndefined();
  });

  it('defaults a missing type from schemaName presence', () => {
    expect(toRenderRow({ databaseName: 'x' })?.type).toBe('db');
    expect(toRenderRow({ databaseName: 'x', schemaName: 's' })?.type).toBe('schema');
  });
});

describe('isAlreadyDeny / isParentDeny', () => {
  const excludedIds = new Set(['stg', 'prd']);

  it('isAlreadyDeny is set membership on the row id', () => {
    expect(isAlreadyDeny('stg', excludedIds)).toBe(true);
    expect(isAlreadyDeny('live', excludedIds)).toBe(false);
  });

  it('isParentDeny is true for a schema whose parent database is excluded', () => {
    expect(isParentDeny({ type: 'schema', database: 'prd' }, excludedIds)).toBe(true);
    expect(isParentDeny({ type: 'schema', database: 'live' }, excludedIds)).toBe(false);
    // a DATABASE row is never a "parent-deny" child
    expect(isParentDeny({ type: 'db', database: 'prd' }, excludedIds)).toBe(false);
  });
});

describe('buildVisibleDenyRows', () => {
  const testedRows: LogicalDatabase[] = TESTED.map((t) => toRenderRow(t)!).filter(Boolean);

  it('unions excluded-only items (the stub silently dropped these)', () => {
    const ids = new Set(EXCLUDED.map((e) => denyId({ database: e.databaseName, schema: e.schemaName })));
    const rows = buildVisibleDenyRows(testedRows, EXCLUDED, ids);
    expect(rows.some((r) => r.id === 'legacy')).toBe(true);
  });

  it('hides a child schema when its parent database is excluded', () => {
    // Exclude prd (DATABASE) → prd.temp must collapse under it.
    const ids = new Set(['prd', 'prd.temp']);
    const rows = buildVisibleDenyRows(testedRows, [], ids);
    expect(rows.some((r) => r.id === 'prd')).toBe(true);
    expect(rows.some((r) => r.id === 'prd.temp')).toBe(false);
  });
});

describe('buildModalData', () => {
  it('seeds the draft + stamps existingDenyReason on greyed-out rows', () => {
    const { databases, initialDraft } = buildModalData(TESTED, EXCLUDED);
    // tested rows (9) + excluded-only legacy (1) = 10 left-panel rows
    expect(databases).toHaveLength(10);
    expect(databases.find((d) => d.id === 'stg')?.existingDenyReason).toBe('STG');
    expect(databases.find((d) => d.id === 'prd.temp')?.existingDenyReason).toBe('TEMP');
    expect(Array.from(initialDraft.excludedIds).sort()).toEqual([
      'dev',
      'legacy',
      'prd.temp',
      'stg',
    ]);
    expect(initialDraft.reasons['prd.temp']).toBe('TEMP');
  });
});

describe('draftToExcludedItems (PUT serialization)', () => {
  const { databases } = buildModalData(TESTED, EXCLUDED);

  it('emits one DATABASE item per excluded db and omits child schemas under it', () => {
    // Exclude the prd DATABASE (and its child prd.temp); child must NOT be emitted.
    const draft = {
      excludedIds: new Set(['prd', 'prd.temp']),
      reasons: { prd: 'STG' as const, 'prd.temp': 'TEMP' as const },
    };
    const items = draftToExcludedItems(databases, draft);
    expect(items).toEqual([{ databaseName: 'prd', type: 'DATABASE', skipReason: 'STG' }]);
  });

  it('emits an individually-excluded SCHEMA when its parent is not excluded', () => {
    const draft = {
      excludedIds: new Set(['live.public']),
      reasons: { 'live.public': 'DEV' as const },
    };
    const items = draftToExcludedItems(databases, draft);
    expect(items).toEqual([
      { databaseName: 'live', schemaName: 'public', type: 'SCHEMA', skipReason: 'DEV' },
    ]);
  });

  it('defaults skip_reason to TEMP when neither the draft nor an existing skip has one', () => {
    // 'live' is discovered but NOT in the initial policy, so it has no
    // existingDenyReason to fall back to → defaults to TEMP.
    const draft = { excludedIds: new Set(['live']), reasons: {} };
    const items = draftToExcludedItems(databases, draft);
    expect(items).toEqual([{ databaseName: 'live', type: 'DATABASE', skipReason: 'TEMP' }]);
  });

  it('falls back to an existing skip reason before defaulting to TEMP', () => {
    // 'dev' is in the seeded policy with reason DEV; a draft without an explicit
    // reason must reuse DEV, not clobber it with TEMP.
    const draft = { excludedIds: new Set(['dev']), reasons: {} };
    const items = draftToExcludedItems(databases, draft);
    expect(items).toEqual([{ databaseName: 'dev', type: 'DATABASE', skipReason: 'DEV' }]);
  });
});
