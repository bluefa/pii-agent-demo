/**
 * Collaboration channel — the Jira ticket the BFF creates for a target source after
 * 인프라 등록 (BE PR #8891, 2026-09-30 revision; docs/api/ops-assumed-contracts.md §4).
 *
 * The wire is snake and every field is optional/nullable until the swagger declares it.
 * `toCollaborationChannel` is the one reader both the Server Component (via the BFF)
 * and the CSR helper (via the Next route) run, so the two surfaces never disagree
 * about what a response means.
 */

export const COLLABORATION_CHANNEL_STATUSES = [
  'CREATED',
  'PENDING',
  'RETRYING',
  'FAILED',
  'NONE',
] as const;

export type CollaborationChannelStatus = (typeof COLLABORATION_CHANNEL_STATUSES)[number];

/** SHORT_TERM = 10-minute interval, LONG_TERM = 24-hour interval; both are still RETRYING. */
export type RetryPhase = 'SHORT_TERM' | 'LONG_TERM';

/**
 * One watcher the BFF could not add to the ticket. Rides the channel GET, paginated
 * (`watcher_page` / `watcher_size`), ordered by username. Watcher status is only
 * FAILED | PENDING (PENDING = still retrying, auth waits included) — independent of
 * the ticket status. `username` is the Jira username, not a PASS id.
 */
export interface FailedWatcher {
  username: string;
  status: 'FAILED' | 'PENDING';
  attemptCount: number | null;
  retryPhase: RetryPhase | null;
  nextAttemptAt: string | null;
  retryExpiresAt: string | null;
}

export interface CollaborationChannel {
  /** "has a ticket" = `!!issueKey`. `""` (PENDING/RETRYING/FAILED) and null (NONE) both mean none. */
  issueKey: string | null;
  url: string | null;
  status: CollaborationChannelStatus;
  attemptCount: number | null;
  /** May be null while RETRYING (LONG_TERM sample: attempt 6, max null). */
  maxAttempts: number | null;
  /** Server-local datetime, fractional seconds, NO offset — never convert; print as-is. */
  nextAttemptAt: string | null;
  retryPhase: RetryPhase | null;
  /** 14 days after the first real attempt; at expiry the ticket flips to FAILED. */
  retryExpiresAt: string | null;
  /** One page of failed watchers — `[]` when none, past the end, or no ticket. */
  failedWatchers: FailedWatcher[];
  /** People count for this ticket (≠ the summary's target-source count). */
  failedWatchersTotal: number;
  watcherPage: number;
  watcherSize: number;
}

const isStatus = (value: unknown): value is CollaborationChannelStatus =>
  typeof value === 'string'
  && (COLLABORATION_CHANNEL_STATUSES as readonly string[]).includes(value);

const isRetryPhase = (value: unknown): value is RetryPhase =>
  value === 'SHORT_TERM' || value === 'LONG_TERM';

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const field = (raw: object, key: string): unknown =>
  key in raw ? (raw as Record<string, unknown>)[key] : undefined;

/** An entry without a string username or a status outside FAILED | PENDING is dropped. */
function readFailedWatchers(list: unknown): FailedWatcher[] {
  if (!Array.isArray(list)) return [];
  const watchers: FailedWatcher[] = [];
  for (const entry of list) {
    if (entry === null || typeof entry !== 'object') continue;
    const username = field(entry, 'username');
    const status = field(entry, 'status');
    if (typeof username !== 'string' || username === '') continue;
    if (status !== 'FAILED' && status !== 'PENDING') continue;
    const phase = field(entry, 'retry_phase');
    watchers.push({
      username,
      status,
      attemptCount: numberOrNull(field(entry, 'attempt_count')),
      retryPhase: isRetryPhase(phase) ? phase : null,
      nextAttemptAt: stringOrNull(field(entry, 'next_attempt_at')),
      retryExpiresAt: stringOrNull(field(entry, 'retry_expires_at')),
    });
  }
  return watchers;
}

/**
 * Wire → domain. Returns null when the body is not a channel at all (no object, or a
 * status outside the five) — an unreadable answer is a failed read, not a ticket state.
 */
export function toCollaborationChannel(raw: unknown): CollaborationChannel | null {
  if (raw === null || typeof raw !== 'object') return null;
  const status = field(raw, 'status');
  if (!isStatus(status)) return null;
  const phase = field(raw, 'retry_phase');
  const failedWatchers = readFailedWatchers(field(raw, 'failed_watchers'));
  const total = field(raw, 'failed_watchers_total');
  const page = field(raw, 'watcher_page');
  const size = field(raw, 'watcher_size');
  return {
    issueKey: stringOrNull(field(raw, 'issue_key')),
    url: stringOrNull(field(raw, 'url')),
    status,
    attemptCount: numberOrNull(field(raw, 'attempt_count')),
    maxAttempts: numberOrNull(field(raw, 'max_attempts')),
    nextAttemptAt: stringOrNull(field(raw, 'next_attempt_at')),
    retryPhase: isRetryPhase(phase) ? phase : null,
    retryExpiresAt: stringOrNull(field(raw, 'retry_expires_at')),
    failedWatchers,
    failedWatchersTotal: typeof total === 'number' ? total : failedWatchers.length,
    watcherPage: typeof page === 'number' ? page : 0,
    watcherSize: typeof size === 'number' && size > 0 ? size : 10,
  };
}

/**
 * `MM-DD HH:mm` out of a server-local datetime — a string cut, not a Date, so no
 * timezone is applied to a value that carries none. LONG_TERM attempts are a day
 * apart, so the day is part of the answer. Anything unparseable is null.
 */
export function localClock(datetime: string | null): string | null {
  const match = datetime?.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]} ${match[3]}:${match[4]}` : null;
}
