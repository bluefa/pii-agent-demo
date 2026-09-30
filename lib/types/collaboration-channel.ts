/**
 * Collaboration channel — the Jira ticket the BFF creates for a target source after
 * 인프라 등록 (BE PR #8891, ahead of the swagger drop; docs/api/ops-assumed-contracts.md §4).
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

export interface CollaborationChannel {
  /** "has a ticket" = `!!issueKey`. `""` (PENDING/RETRYING/FAILED) and null (NONE) both mean none. */
  issueKey: string | null;
  url: string | null;
  status: CollaborationChannelStatus;
  /** May be 0 on RETRYING (auth problems) — the screen hides the count then. */
  attemptCount: number | null;
  maxAttempts: number | null;
  /** Server-local datetime, fractional seconds, NO offset — never convert; print as-is. */
  nextAttemptAt: string | null;
}

const isStatus = (value: unknown): value is CollaborationChannelStatus =>
  typeof value === 'string'
  && (COLLABORATION_CHANNEL_STATUSES as readonly string[]).includes(value);

/**
 * Wire → domain. Returns null when the body is not a channel at all (no object, or a
 * status outside the five) — an unreadable answer is a failed read, not a ticket state.
 */
export function toCollaborationChannel(raw: unknown): CollaborationChannel | null {
  if (raw === null || typeof raw !== 'object') return null;
  const status = 'status' in raw ? raw.status : null;
  if (!isStatus(status)) return null;
  const issueKey = 'issue_key' in raw ? raw.issue_key : null;
  const url = 'url' in raw ? raw.url : null;
  const attemptCount = 'attempt_count' in raw ? raw.attempt_count : null;
  const maxAttempts = 'max_attempts' in raw ? raw.max_attempts : null;
  const nextAttemptAt = 'next_attempt_at' in raw ? raw.next_attempt_at : null;
  return {
    issueKey: typeof issueKey === 'string' && issueKey !== '' ? issueKey : null,
    url: typeof url === 'string' && url !== '' ? url : null,
    status,
    attemptCount: typeof attemptCount === 'number' ? attemptCount : null,
    maxAttempts: typeof maxAttempts === 'number' ? maxAttempts : null,
    nextAttemptAt: typeof nextAttemptAt === 'string' ? nextAttemptAt : null,
  };
}

/**
 * `HH:mm` out of the server-local `next_attempt_at` — a string cut, not a Date, so no
 * timezone is applied to a value that carries none. Anything unparseable is null.
 */
export function nextAttemptClock(nextAttemptAt: string | null): string | null {
  const match = nextAttemptAt?.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}
