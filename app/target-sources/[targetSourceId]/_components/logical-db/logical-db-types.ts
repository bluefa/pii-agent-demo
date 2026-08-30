/**
 * Local render/draft shape for the logical-DB modal. The BFF data is fetched and
 * adapted in `useLogicalDatabases` (via `logical-db-deny.ts`); these types are the
 * modal's UI contract, distinct from the camel domain models in
 * `@/app/lib/api/logical-db`.
 */

import type { SkipReason } from '@/app/lib/api/logical-db';
import type { AppErrorCode } from '@/lib/errors';

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
  /**
   * Policy-only entry: in the skip list but absent from this run's Tested list.
   * Expected state, not an anomaly — an excluded DB is simply not collected by
   * the next Test Connection, so it keeps living here as policy.
   */
  untested?: boolean;
  /**
   * Synthesized DATABASE parent for a database that appears only through its
   * SCHEMA rows (real PG targets report schemas only). Not a Tested entry
   * itself, but a valid DATABASE-scope exclusion target.
   */
  virtual?: boolean;
}

export interface LogicalDbModalDraft {
  /** ids the user has moved into Panel B (deny side) */
  excludedIds: ReadonlySet<string>;
  /** per-id skip reason — typed enum so it serializes to the PUT `skip_reason` */
  reasons: Readonly<Record<string, SkipReason>>;
}

export interface LogicalDbModalProps {
  open: boolean;
  /** Physical resource key — the one identifier that is always present. */
  resourceId: string;
  resourceName: string;
  /**
   * 엔진 배지(`getDatabaseShortLabel`) — 운영자 화면만 넘긴다. 여러 리소스를 훑는 사람은
   * 이름만으로 무슨 엔진인지 알 수 없다. 없으면 배지 자체가 없다(요청자 화면은 그대로).
   */
  databaseType?: string | null;
  /**
   * Completion instant of the connection-test run this list came from (ISO-8601 UTC string,
   * `latestJob.completed_at`). `null` when the caller has no settled run — the header then
   * omits the provenance line rather than naming a time it does not have.
   */
  completedAt: string | null;
  /** loaded list. UI does not fetch — caller passes data in. */
  databases: ReadonlyArray<LogicalDatabase>;
  /** initial draft (defaults to empty if omitted) */
  initialDraft?: LogicalDbModalDraft;
  /**
   * Shown above the table when the run's discovered list could not be read. The skip policy
   * still is, so the modal edits and saves normally — only the discovered half is missing.
   */
  notice?: string;
  /**
   * Present = this caller may add rows by hand (admin). Absent = today's screen, unchanged.
   *
   * A hand-typed row is policy, not a test result: it never reaches `databases`, so the save
   * is handed the rows the modal actually rendered (`rows` below) rather than the fetched
   * list — `draftToExcludedItems` drops any id it cannot find a row for.
   */
  manualEntry?: boolean;
  /**
   * `rows` is the list the draft was made against — the fetched `databases` plus anything
   * typed in by hand. Serialize the PUT from IT, never from `databases`.
   */
  onSave: (draft: LogicalDbModalDraft, rows: ReadonlyArray<LogicalDatabase>) => void;
  /**
   * The save is in flight. PENDING IS THE BUTTON'S STATE, NOT A FRAME: the table stays
   * exactly where it is and only the footer controls disable, so nothing moves under the
   * hand that just pressed 저장.
   */
  saving?: boolean;
  /** How the save ended. Present = the result frame replaces the table and the footer. */
  result?: LogicalDbSaveResult | null;
  /** 다시 저장하기 on a retriable error frame. Re-sends the draft that just failed. */
  onRetry?: () => void;
  onClose: () => void;
}

/**
 * What the save ended as. The error carries the **code**, never the server's message —
 * the copy is picked from it in `logical-db-failures.ts` (ADR-008 / ADR-013 §D2).
 */
export type LogicalDbSaveResult =
  | { kind: 'success' }
  /**
   * 저장은 끝났고, 그 뒤의 목록 재조회만 실패했다 — 성공의 갈래지 실패가 아니다.
   * 실패로 말하면 "서버의 제외 정책은 그대로예요" 라는 거짓말이 되고, 사용자는 이미
   * 반영된 변경을 한 번 더 저장한다.
   */
  | { kind: 'stale' }
  | { kind: 'error'; code: AppErrorCode };

export type LogicalDbDataState =
  | { status: 'loading' }
  | { status: 'ready'; databases: LogicalDatabase[]; initialDraft: LogicalDbModalDraft }
  /**
   * The tested list failed but the skip policy came back. Editing and saving are safe: the
   * PUT replaces the whole policy and the whole policy is in hand — only the run's
   * discovered rows are missing, so the table shows the policy alone with a notice.
   *
   * ⛔ NOT the mirror case. When the EXCLUDED fetch fails the state is `error`, because
   * saving over a policy we could not read would silently delete somebody's exclusions.
   */
  | { status: 'partial'; databases: LogicalDatabase[]; initialDraft: LogicalDbModalDraft }
  | { status: 'error'; message: string };

export interface LogicalDbDataHook {
  state: LogicalDbDataState;
  retry: () => void;
}
