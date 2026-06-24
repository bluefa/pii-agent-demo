/**
 * Logical DB (Step 5 modal) — wire→domain normalizers (ADR-019 D2/D6).
 *
 * The single casing boundary lives in the CSR client / route handlers: each GET
 * does `normalizeX(camelCaseKeys(raw))`. These functions take the already
 * camelCased payload as `unknown` and build a strictly-typed domain object
 * field-by-field — the "loud" alternative to a silent `as T` (no zod dependency
 * in this repo; mirrors `lib/test-connection-response.ts`).
 *
 * Tested vs Excluded differ on the wire and stay distinct here:
 *   Tested   item: every field optional (swagger marks none required) →
 *                  malformed rows (no databaseName) are dropped by the caller.
 *   Excluded item: databaseName / skipReason / type are required →
 *                  a row missing them is dropped (cannot be serialized back).
 * Enum values pass through verbatim from swagger; an out-of-contract value
 * degrades to a row drop rather than throwing, so a stray BFF value cannot
 * 500 the modal.
 */

import type {
  ExcludedLogicalDatabase,
  LogicalDbType,
  SkipReason,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

// ===== Helpers =====

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const LOGICAL_DB_TYPES: readonly LogicalDbType[] = ['DATABASE', 'SCHEMA'];

const asLogicalDbType = (value: unknown): LogicalDbType | undefined =>
  LOGICAL_DB_TYPES.includes(value as LogicalDbType) ? (value as LogicalDbType) : undefined;

const SKIP_REASONS: readonly SkipReason[] = ['STG', 'DEV', 'TEMP'];

const asSkipReason = (value: unknown): SkipReason | undefined =>
  SKIP_REASONS.includes(value as SkipReason) ? (value as SkipReason) : undefined;

// ===== Tested (left panel) =====

/**
 * Normalize `TestedLogicalDatabasesResponse.logicalDatabaseList`.
 * Drops rows with no `databaseName` (swagger allows the field to be absent, but
 * a row without an identity cannot key into the modal). `type`/`schemaName`
 * remain optional; the adapter infers a default `type` from `schemaName`.
 */
export const normalizeTestedLogicalDatabases = (raw: unknown): TestedLogicalDatabase[] => {
  const list = asRecord(raw).logicalDatabaseList;
  if (!Array.isArray(list)) return [];
  const out: TestedLogicalDatabase[] = [];
  for (const item of list) {
    const r = asRecord(item);
    const databaseName = asString(r.databaseName);
    if (!databaseName) continue;
    const schemaName = asString(r.schemaName);
    out.push({
      databaseName,
      ...(schemaName ? { schemaName } : {}),
      ...((): { type?: LogicalDbType } => {
        const type = asLogicalDbType(r.type);
        return type ? { type } : {};
      })(),
    });
  }
  return out;
};

// ===== Excluded (right panel / skip policy) =====

/**
 * Normalize `SkipLogicalDatabaseResponse.skipLogicalDatabaseList`.
 * `databaseName`, `skipReason`, `type` are required by swagger — a row missing
 * any of the three is dropped (it could not be re-serialized to the PUT body).
 */
export const normalizeExcludedLogicalDatabases = (raw: unknown): ExcludedLogicalDatabase[] => {
  const list = asRecord(raw).skipLogicalDatabaseList;
  if (!Array.isArray(list)) return [];
  const out: ExcludedLogicalDatabase[] = [];
  for (const item of list) {
    const r = asRecord(item);
    const databaseName = asString(r.databaseName);
    const skipReason = asSkipReason(r.skipReason);
    const type = asLogicalDbType(r.type);
    if (!databaseName || !skipReason || !type) continue;
    const schemaName = asString(r.schemaName);
    out.push({
      databaseName,
      ...(schemaName ? { schemaName } : {}),
      skipReason,
      type,
    });
  }
  return out;
};
