/**
 * Logical DB (Step 5 modal) — pure adapter + dedup/parent-child helpers.
 *
 * Bridges the camel domain models (`TestedLogicalDatabase` / `ExcludedLogicalDatabase`
 * from `@/app/lib/api/logical-db`) to the modal's render/draft shape
 * (`LogicalDatabase` / `LogicalDbModalDraft`). All functions are pure and unit-tested
 * (spec B §4.1–§4.4).
 *
 * The single id scheme (`denyId`) is the join key between the Tested rows (left) and
 * the Excluded items (right): `${database}` for a DATABASE, `${database}.${schema}`
 * for a SCHEMA. Both sides compute it identically so set-membership lines up.
 */

import type {
  ExcludedLogicalDatabase,
  LogicalDbType,
  SkipReason,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

/** The single shared id scheme for a logical-DB row / skip item. */
export const denyId = (parts: { database: string; schema?: string }): string =>
  parts.schema ? `${parts.database}.${parts.schema}` : parts.database;

/** wire enum (DATABASE/SCHEMA) → modal render enum (db/schema). */
const toRenderType = (wire: LogicalDbType): LogicalDatabase['type'] =>
  wire === 'SCHEMA' ? 'schema' : 'db';

/** modal render enum (db/schema) → wire enum (DATABASE/SCHEMA). */
export const toWireType = (type: LogicalDatabase['type']): LogicalDbType =>
  type === 'schema' ? 'SCHEMA' : 'DATABASE';

/**
 * Map a Tested item to a render row (spec §4.1). Returns `undefined` for a
 * malformed row (no `databaseName`) so the caller can drop it. A missing `type`
 * defaults to `db` only when there is no `schemaName` (else `schema`).
 */
export const toRenderRow = (item: TestedLogicalDatabase): LogicalDatabase | undefined => {
  if (!item.databaseName) return undefined;
  const id = denyId({ database: item.databaseName, schema: item.schemaName });
  const type: LogicalDatabase['type'] = item.type
    ? toRenderType(item.type)
    : item.schemaName
      ? 'schema'
      : 'db';
  return {
    id,
    name: id,
    type,
    database: item.databaseName,
    ...(item.schemaName ? { schema: item.schemaName } : {}),
  };
};

/** Map an Excluded item to a render row (right-panel / excluded-only items). */
const excludedToRenderRow = (item: ExcludedLogicalDatabase): LogicalDatabase => {
  const id = denyId({ database: item.databaseName, schema: item.schemaName });
  return {
    id,
    name: id,
    type: toRenderType(item.type),
    database: item.databaseName,
    ...(item.schemaName ? { schema: item.schemaName } : {}),
    existingDenyReason: item.skipReason,
  };
};

/** Row id is already in the current excluded set → left "제외" is a grey no-op. */
export const isAlreadyDeny = (rowId: string, excludedIds: ReadonlySet<string>): boolean =>
  excludedIds.has(rowId);

/** A SCHEMA row whose parent DATABASE id is in the excluded set (implied-denied). */
export const isParentDeny = (
  row: Pick<LogicalDatabase, 'type' | 'database'>,
  excludedIds: ReadonlySet<string>,
): boolean => row.type === 'schema' && excludedIds.has(row.database);

/**
 * The right-panel source (spec §4.3): the union of
 *   (a) Tested rows currently marked excluded, and
 *   (b) Excluded items with no matching Tested row (excluded-only — e.g. a DB
 *       skipped last round that no longer appears in the discovered list),
 * then collapse any deny row whose parent DATABASE is also denied (a child SCHEMA
 * hidden under an excluded parent). Deduped by id; sentence: never drops (b),
 * which the old stub silently did.
 */
export const buildVisibleDenyRows = (
  tested: readonly LogicalDatabase[],
  excluded: readonly ExcludedLogicalDatabase[],
  excludedIds: ReadonlySet<string>,
): LogicalDatabase[] => {
  const byId = new Map<string, LogicalDatabase>();

  for (const row of tested) {
    if (excludedIds.has(row.id)) byId.set(row.id, row);
  }
  for (const item of excluded) {
    const id = denyId({ database: item.databaseName, schema: item.schemaName });
    if (!byId.has(id)) byId.set(id, excludedToRenderRow(item));
  }

  // Collapse children hidden under an excluded parent DATABASE.
  const out: LogicalDatabase[] = [];
  for (const row of byId.values()) {
    if (isParentDeny(row, excludedIds)) continue;
    out.push(row);
  }
  return out;
};

/**
 * Build the modal's left-panel rows + the seeded initial draft from the two
 * fetched lists (spec §4.1/§4.2). The left panel stamps `existingDenyReason` on
 * each Tested row already covered by the skip policy (drives the grey-out).
 */
export const buildModalData = (
  tested: readonly TestedLogicalDatabase[],
  excluded: readonly ExcludedLogicalDatabase[],
): { databases: LogicalDatabase[]; initialDraft: LogicalDbModalDraft } => {
  const excludedIds = new Set(
    excluded.map((e) => denyId({ database: e.databaseName, schema: e.schemaName })),
  );
  const reasons: Record<string, SkipReason> = {};
  for (const e of excluded) {
    reasons[denyId({ database: e.databaseName, schema: e.schemaName })] = e.skipReason;
  }

  const testedRows: LogicalDatabase[] = [];
  for (const item of tested) {
    const row = toRenderRow(item);
    if (!row) continue;
    const reason = reasons[row.id];
    testedRows.push(reason ? { ...row, existingDenyReason: reason } : row);
  }

  // The left panel must also surface excluded-only items (in the policy but not
  // discovered) so they can be restored; merge them in once.
  const seen = new Set(testedRows.map((r) => r.id));
  for (const item of excluded) {
    const id = denyId({ database: item.databaseName, schema: item.schemaName });
    if (seen.has(id)) continue;
    testedRows.push(excludedToRenderRow(item));
    seen.add(id);
  }

  return { databases: testedRows, initialDraft: { excludedIds, reasons } };
};

/**
 * Serialize the modal draft to the PUT skip set (spec §4.4 / §4.3.1). Full
 * replace. A child SCHEMA whose parent DATABASE is also excluded is omitted (the
 * parent implies it). Every emitted row needs a `skip_reason`; rows with no
 * explicit reason default to `TEMP` (D-5 option a — there is no reason picker yet).
 */
export const draftToExcludedItems = (
  databases: readonly LogicalDatabase[],
  draft: LogicalDbModalDraft,
): ExcludedLogicalDatabase[] => {
  const rowsById = new Map(databases.map((r) => [r.id, r]));
  const out: ExcludedLogicalDatabase[] = [];
  for (const id of draft.excludedIds) {
    const row = rowsById.get(id);
    if (!row) continue;
    // Child collapsed under an excluded parent → omit (parent implies it).
    if (isParentDeny(row, draft.excludedIds)) continue;
    out.push({
      databaseName: row.database,
      ...(row.type === 'schema' && row.schema ? { schemaName: row.schema } : {}),
      type: toWireType(row.type),
      skipReason: draft.reasons[id] ?? row.existingDenyReason ?? 'TEMP',
    });
  }
  return out;
};
