/**
 * Logical DB (Step 5 modal) — CSR client + camel domain types.
 *
 * The single casing boundary for this domain is the CSR client: each GET does
 * `normalizeX(camelCaseKeys(raw))` via `fetchInfraCamelJson` + the hand-written
 * normalizers in `lib/logical-db-response.ts` (no silent `as T`, ADR-019 D6).
 * The PUT request body is authored snake to match swagger (D3) — never blanket
 * `snakeCaseKeys`.
 *
 * The modal only ever has a `resourceId` (`ConfirmedResource.resourceId`), so
 * this client uses the `by-resource-id` swagger variants exclusively. The
 * `agentId`-keyed variants are out of the modal's path (spec B §6 D-1).
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (getTestedLogicalDatabasesByResourceId /
 * getExcludedLogicalDatabasesByResourceId / updateExcludedLogicalDatabasesByResourceId).
 */

import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import {
  normalizeExcludedLogicalDatabases,
  normalizeTestedLogicalDatabases,
} from '@/lib/logical-db-response';
import type { UpdateSkipLogicalDatabaseRequestWire } from '@/lib/bff/types/logical-db';

// ---------------------------------------------------------------------------
// Domain types (camel — the UI contract). The wire snake shape never leaks
// past this file (ADR-019 D1).
// ---------------------------------------------------------------------------

export type LogicalDbType = 'DATABASE' | 'SCHEMA';
export type SkipReason = 'STG' | 'DEV' | 'TEMP';

export interface TestedLogicalDatabase {
  databaseName?: string;
  schemaName?: string;
  type?: LogicalDbType;
}

/** "skip" item, camel. */
export interface ExcludedLogicalDatabase {
  databaseName: string;
  schemaName?: string;
  skipReason: SkipReason;
  type: LogicalDbType;
}

// ---------------------------------------------------------------------------
// Client functions (GET variants accept an AbortSignal — modal can cancel on
// close / resource change). All use the `by-resource-id` swagger variants.
// ---------------------------------------------------------------------------

const base = (targetSourceId: number) => `/target-sources/${targetSourceId}`;

/** GET tested logical DBs (left panel) by resourceId. */
export const getTestedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  opts?: { signal?: AbortSignal },
): Promise<TestedLogicalDatabase[]> => {
  const raw = await fetchInfraCamelJson<unknown>(
    `${base(targetSourceId)}/tested-logical-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return normalizeTestedLogicalDatabases(raw);
};

/** GET the current skip policy (right panel) by resourceId. */
export const getExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  opts?: { signal?: AbortSignal },
): Promise<ExcludedLogicalDatabase[]> => {
  const raw = await fetchInfraCamelJson<unknown>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return normalizeExcludedLogicalDatabases(raw);
};

/** PUT the skip policy (full replace) by resourceId. Body authored snake (D3). */
export const updateExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  items: ExcludedLogicalDatabase[],
): Promise<ExcludedLogicalDatabase[]> => {
  const body: UpdateSkipLogicalDatabaseRequestWire = {
    skip_logical_database_list: items.map((it) => ({
      database_name: it.databaseName,
      ...(it.schemaName ? { schema_name: it.schemaName } : {}),
      skip_reason: it.skipReason,
      type: it.type,
    })),
  };
  const raw = await fetchInfraCamelJson<unknown>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    { method: 'PUT', body },
  );
  return normalizeExcludedLogicalDatabases(raw);
};
