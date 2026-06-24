/**
 * Local render/draft shape for the logical-DB modal. The BFF data is fetched and
 * adapted in `useLogicalDatabases` (via `logical-db-deny.ts`); these types are the
 * modal's UI contract, distinct from the camel domain models in
 * `@/app/lib/api/logical-db`.
 */

import type { SkipReason } from '@/app/lib/api/logical-db';

/**
 * A logical-DB entry is either a whole database (`'db'`) or a single
 * schema within one (`'schema'`). Mirrors the v16 mockup data model
 * (`type` / `dbName` / `schemaName`), surfaced here as discrete
 * `type` / `database` / `schema` fields the modal renders per row.
 */
export type LogicalDatabaseType = 'db' | 'schema';

export interface LogicalDatabase {
  /** unique identifier — typically `<server>.<database>[.<schema>]` */
  id: string;
  /** display name shown in the panel — `database` or `database.schema` */
  name: string;
  /** whether this row represents a database or a schema */
  type: LogicalDatabaseType;
  /** physical/logical database name */
  database: string;
  /** schema name — present only when `type` is `'schema'` */
  schema?: string;
  /** when present, an existing skip policy already excludes this entry */
  existingDenyReason?: SkipReason;
}

export interface LogicalDbModalDraft {
  /** ids the user has moved into Panel B (deny side) */
  excludedIds: ReadonlySet<string>;
  /** per-id skip reason — typed enum so it serializes to the PUT `skip_reason` */
  reasons: Readonly<Record<string, SkipReason>>;
}

export interface LogicalDbModalProps {
  open: boolean;
  resourceName: string;
  /** loaded list. UI does not fetch — caller passes data in. */
  databases: ReadonlyArray<LogicalDatabase>;
  /** initial draft (defaults to empty if omitted) */
  initialDraft?: LogicalDbModalDraft;
  onSave: (draft: LogicalDbModalDraft) => void;
  onClose: () => void;
}

export type LogicalDbDataState =
  | { status: 'loading' }
  | { status: 'ready'; databases: LogicalDatabase[]; initialDraft: LogicalDbModalDraft }
  | { status: 'error'; message: string };

export interface LogicalDbDataHook {
  state: LogicalDbDataState;
  retry: () => void;
}
