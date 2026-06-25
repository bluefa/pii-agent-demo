/**
 * Logical DB (Step 5 modal) — CSR client + camel domain types.
 *
 * ADR-019: casing boundary is the CSR client. Routes emit raw snake wire
 * (validated by schemas.X.parse); this client reads snake, reshapes to camel
 * domain types. PUT body authored snake to match swagger (D3).
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (getTestedLogicalDatabasesByResourceId /
 * getExcludedLogicalDatabasesByResourceId / updateExcludedLogicalDatabasesByResourceId).
 */

import { fetchInfraJson } from '@/app/lib/api/infra';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

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
// Adapters: snake wire → camel domain.
// ---------------------------------------------------------------------------

type TestedItemWire = NonNullable<z.infer<typeof schemas.TestedLogicalDatabasesResponse>['logical_database_list']>[number];
type SkipItemWire = NonNullable<z.infer<typeof schemas.SkipLogicalDatabaseResponse>['skip_logical_database_list']>[number];

const toTestedLogicalDatabase = (item: TestedItemWire): TestedLogicalDatabase => ({
  ...(item.database_name ? { databaseName: item.database_name } : {}),
  ...(item.schema_name ? { schemaName: item.schema_name } : {}),
  ...(item.type ? { type: item.type as LogicalDbType } : {}),
});

const toExcludedLogicalDatabase = (item: SkipItemWire): ExcludedLogicalDatabase => ({
  databaseName: item.database_name,
  ...(item.schema_name ? { schemaName: item.schema_name } : {}),
  skipReason: item.skip_reason,
  type: item.type,
});

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
  const raw = await fetchInfraJson<z.infer<typeof schemas.TestedLogicalDatabasesResponse>>(
    `${base(targetSourceId)}/tested-logical-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return (raw.logical_database_list ?? []).map(toTestedLogicalDatabase);
};

/** GET the current skip policy (right panel) by resourceId. */
export const getExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  opts?: { signal?: AbortSignal },
): Promise<ExcludedLogicalDatabase[]> => {
  const raw = await fetchInfraJson<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return (raw.skip_logical_database_list ?? []).map(toExcludedLogicalDatabase);
};

/** PUT the skip policy (full replace) by resourceId. Body authored snake (D3). */
export const updateExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  items: ExcludedLogicalDatabase[],
): Promise<ExcludedLogicalDatabase[]> => {
  const body: z.infer<typeof schemas.UpdateSkipLogicalDatabaseRequest> = {
    skip_logical_database_list: items.map((it) => ({
      database_name: it.databaseName,
      ...(it.schemaName ? { schema_name: it.schemaName } : {}),
      skip_reason: it.skipReason,
      type: it.type,
    })),
  };
  const raw = await fetchInfraJson<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    { method: 'PUT', body },
  );
  return (raw.skip_logical_database_list ?? []).map(toExcludedLogicalDatabase);
};
