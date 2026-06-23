/**
 * Local domain shape for the logical-DB modal. No BFF backing yet —
 * the shapes are declared here, not in `lib/types`, to make it explicit
 * that they will move to `lib/types` (or under `swagger/`) when the
 * BFF endpoints land.
 */

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
  /** when present, an existing deny policy already excludes this entry */
  existingDenyReason?: string;
}

export interface LogicalDbModalDraft {
  /** ids the user has moved into Panel B (deny side) */
  excludedIds: ReadonlySet<string>;
  /** optional per-id reason text the user entered */
  reasons: Readonly<Record<string, string>>;
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
  | { status: 'ready'; databases: LogicalDatabase[] }
  | { status: 'error'; message: string };

export interface LogicalDbDataHook {
  state: LogicalDbDataState;
  retry: () => void;
}
