/**
 * Local domain shape for the logical-DB modal. No BFF backing yet —
 * the shapes are declared here, not in `lib/types`, to make it explicit
 * that they will move to `lib/types` (or under `swagger/`) when the
 * BFF endpoints land.
 */

export interface LogicalDatabase {
  /** unique identifier — typically `<server>.<database>` */
  id: string;
  /** display name shown in the panel */
  name: string;
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
