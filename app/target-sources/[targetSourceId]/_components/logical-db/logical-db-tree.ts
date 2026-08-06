/**
 * Logical DB tree — pure helpers for the Step 5 "논리 DB 목록" modal.
 *
 * The modal renders the union (Tested ∪ Excluded) as a Database ▸ Schema tree:
 * the hierarchy IS the exclusion scope. Excluding a DATABASE node covers every
 * schema under it (children render as inherited and are absorbed out of the
 * draft); excluding a SCHEMA node covers that schema only. A target never mixes
 * units — MySQL yields DATABASE rows only (flat list), PG yields SCHEMA rows
 * grouped under their (possibly virtual) DATABASE parent.
 */

import type { LogicalDatabase, LogicalDbModalDraft } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

export interface LogicalDbNode {
  /** The DATABASE row (may be `virtual` when only its schemas were discovered). */
  row: LogicalDatabase;
  /** SCHEMA rows under this database, in input order. */
  children: LogicalDatabase[];
}

export interface LogicalDbTree {
  nodes: LogicalDbNode[];
  /** true → PG-style Schema-unit target (grouped tree); false → flat DATABASE list. */
  hasSchemaUnit: boolean;
}

/**
 * Group rows into DATABASE nodes with SCHEMA children, preserving input order.
 * A SCHEMA row arriving before its DATABASE row still lands under it; a SCHEMA
 * row with no DATABASE row at all gets a placeholder node from its own fields
 * (defensive — `buildModalData` synthesizes virtual parents upstream).
 */
export const buildLogicalDbTree = (
  databases: ReadonlyArray<LogicalDatabase>,
): LogicalDbTree => {
  const byDatabase = new Map<string, LogicalDbNode>();
  const order: string[] = [];

  const nodeFor = (database: string, seed: () => LogicalDatabase): LogicalDbNode => {
    const existing = byDatabase.get(database);
    if (existing) return existing;
    const node: LogicalDbNode = { row: seed(), children: [] };
    byDatabase.set(database, node);
    order.push(database);
    return node;
  };

  for (const row of databases) {
    if (row.type === 'db') {
      // A real DATABASE row replaces the placeholder a schema sibling created.
      nodeFor(row.database, () => row).row = row;
    } else {
      const node = nodeFor(row.database, () => ({
        id: row.database,
        name: row.database,
        type: 'db',
        database: row.database,
        virtual: true,
      }));
      node.children.push(row);
    }
  }

  return {
    nodes: order.map((db) => byDatabase.get(db) as LogicalDbNode),
    hasSchemaUnit: databases.some((r) => r.type === 'schema'),
  };
};

/**
 * Query unit, judged from TESTED rows only. The excluded policy must never
 * drive this: a skip list can outlive the topology it was written against and
 * says nothing about what the engine reports. Returns null when nothing was
 * tested — no judgment, so callers hide the unit chip and its tooltip instead
 * of guessing. (Distinct from `hasSchemaUnit`, which is a LAYOUT signal over
 * the whole union — a policy-only schema row still needs schema grammar.)
 */
export const logicalDbUnit = (
  databases: ReadonlyArray<LogicalDatabase>,
): 'schema' | 'database' | null => {
  const tested = databases.filter((d) => !d.untested && !d.virtual);
  if (tested.some((d) => d.type === 'schema')) return 'schema';
  return tested.length > 0 ? 'database' : null;
};

export type LogicalDbRowStatus =
  | 'allow'
  | 'deny'
  | 'staged-exclude'
  | 'staged-restore'
  | 'inherited';

/**
 * Row status from the current draft vs the saved (initial) draft. Inheritance
 * wins for a child whose parent DATABASE is currently excluded — DB-scope and
 * schema-scope exclusions never coexist, so the child's own membership is moot.
 */
export const logicalDbRowStatus = (
  id: string,
  parentId: string | undefined,
  currentExcluded: ReadonlySet<string>,
  initialExcluded: ReadonlySet<string>,
): LogicalDbRowStatus => {
  if (parentId && currentExcluded.has(parentId)) return 'inherited';
  const inCurrent = currentExcluded.has(id);
  const inInitial = initialExcluded.has(id);
  if (inCurrent && inInitial) return 'deny';
  if (inCurrent) return 'staged-exclude';
  if (inInitial) return 'staged-restore';
  return 'allow';
};

/** 제외 계열(확정·예정·상속) 여부 — 필터의 "제외" 버킷. */
export const isDenyish = (status: LogicalDbRowStatus): boolean =>
  status === 'deny' || status === 'staged-exclude' || status === 'inherited';

/**
 * Middle truncation for places that cannot ellipsis via CSS (footer diff, the
 * popover's confirmation sentence). Head AND tail both survive: real-world
 * names disambiguate at the tail (`…_replica` vs `…_archive`).
 */
export const abbrevMiddle = (name: string, head: number, tail: number): string =>
  name.length > head + tail + 1
    ? `${name.slice(0, head)}…${name.slice(-tail)}`
    : name;

/** Staged(저장 전) 변경 한 건 — footer diff 나열용. */
export interface LogicalDbStagedChange {
  id: string;
  name: string;
  action: 'exclude' | 'restore';
}

/** Diff the current draft against the saved one, in `databases` order. */
export const listStagedChanges = (
  databases: ReadonlyArray<LogicalDatabase>,
  draft: LogicalDbModalDraft,
  initial: LogicalDbModalDraft,
): LogicalDbStagedChange[] => {
  const out: LogicalDbStagedChange[] = [];
  for (const row of databases) {
    const inCurrent = draft.excludedIds.has(row.id);
    const inInitial = initial.excludedIds.has(row.id);
    if (inCurrent === inInitial) continue;
    out.push({ id: row.id, name: row.name, action: inCurrent ? 'exclude' : 'restore' });
  }
  return out;
};
