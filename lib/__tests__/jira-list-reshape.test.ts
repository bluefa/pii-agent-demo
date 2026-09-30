/**
 * Jira Ticket console readers — the fields that are NOT in the swagger yet
 * (docs/api/ops-assumed-contracts.md §4 · §12) survive the passthrough as values.
 */
import { describe, expect, it } from 'vitest';

import { toDashboardSummary, toJiraListPage } from '@/lib/types/task-queue';
import { localClock, toCollaborationChannel } from '@/lib/types/collaboration-channel';

const wire = (row: Record<string, unknown>) => ({
  content: [row],
  number: 0,
  totalPages: 1,
  totalElements: 1,
  size: 10,
  first: true,
  last: true,
  numberOfElements: 1,
  empty: false,
});

const ROW = { targetSourceId: 1861, serviceCode: 'STL', cloudProvider: 'AWS' };

const firstRow = (row: Record<string, unknown>) =>
  toJiraListPage(wire(row) as Parameters<typeof toJiraListPage>[0]).content[0];

describe('toDashboardSummary — Jira counts', () => {
  it('reads the two undeclared counts off the passthrough', () => {
    const summary = toDashboardSummary({
      jira_ticket_failed_count: 4,
      jira_watcher_failed_count: 2,
    } as Parameters<typeof toDashboardSummary>[0]);
    expect(summary.jiraTicketFailedCount).toBe(4);
    expect(summary.jiraWatcherFailedCount).toBe(2);
  });

  it('defaults to 0 when absent or not a number', () => {
    const summary = toDashboardSummary({
      jira_ticket_failed_count: '4',
    } as Parameters<typeof toDashboardSummary>[0]);
    expect(summary.jiraTicketFailedCount).toBe(0);
    expect(summary.jiraWatcherFailedCount).toBe(0);
  });
});

describe('toJiraListPage — isSduType', () => {
  it('isSduType comes from metadata.is_sdu_type, strictly true', () => {
    expect(firstRow({ ...ROW, metadata: { is_sdu_type: true } }).isSduType).toBe(true);
    expect(firstRow({ ...ROW, metadata: { is_sdu_type: 'true' } }).isSduType).toBe(false);
    expect(firstRow(ROW).isSduType).toBe(false);
  });

  it('failed_watchers on a list row is ignored — it lives on the channel now', () => {
    const row = firstRow({ ...ROW, failed_watchers: [{ username: 'x', status: 'FAILED' }] });
    expect('failedWatchers' in row).toBe(false);
    expect(row.targetSourceId).toBe(1861);
  });
});

describe('toCollaborationChannel', () => {
  it('"" and null issue_key both mean no ticket', () => {
    expect(toCollaborationChannel({ status: 'RETRYING', issue_key: '' })?.issueKey).toBeNull();
    expect(toCollaborationChannel({ status: 'NONE', issue_key: null })?.issueKey).toBeNull();
    expect(toCollaborationChannel({ status: 'CREATED', issue_key: 'BDCDIP-1' })?.issueKey).toBe('BDCDIP-1');
  });

  it('an unknown status is an unreadable answer (null), not a state', () => {
    expect(toCollaborationChannel({ status: 'WEIRD' })).toBeNull();
    expect(toCollaborationChannel(null)).toBeNull();
  });

  it('retry phase and expiry ride along; unknown phase is null', () => {
    const channel = toCollaborationChannel({
      status: 'RETRYING', attempt_count: 6, max_attempts: null,
      retry_phase: 'LONG_TERM', next_attempt_at: '2026-10-01T00:50:00', retry_expires_at: '2026-10-14T00:00:00',
    });
    expect(channel).toMatchObject({
      attemptCount: 6, maxAttempts: null, retryPhase: 'LONG_TERM',
      nextAttemptAt: '2026-10-01T00:50:00', retryExpiresAt: '2026-10-14T00:00:00',
    });
    expect(toCollaborationChannel({ status: 'RETRYING', retry_phase: 'WEEKLY' })?.retryPhase).toBeNull();
  });

  it('watcher page: [] and echoed page/size by default, entries parsed, malformed dropped', () => {
    const bare = toCollaborationChannel({ status: 'NONE' });
    expect(bare).toMatchObject({ failedWatchers: [], failedWatchersTotal: 0, watcherPage: 0, watcherSize: 5 });

    const channel = toCollaborationChannel({
      status: 'CREATED', issue_key: 'BDCDIP-2211',
      failed_watchers: [
        { username: 'hong.gildong', status: 'FAILED', attempt_count: 6, retry_phase: null, next_attempt_at: null, retry_expires_at: null },
        { username: 'kim.cs', status: 'PENDING', attempt_count: 3, retry_phase: 'SHORT_TERM', next_attempt_at: '2026-09-30T14:40:00', retry_expires_at: '2026-10-14T00:00:00' },
        { username: 'old.status', status: 'RETRYING', attempt_count: 1 },
        { status: 'FAILED' },
        { username: '' },
        null,
      ],
      failed_watchers_total: 12,
      watcher_page: 1,
      watcher_size: 5,
    });
    expect(channel?.failedWatchers).toEqual([
      { username: 'hong.gildong', status: 'FAILED', attemptCount: 6, retryPhase: null, nextAttemptAt: null, retryExpiresAt: null },
      { username: 'kim.cs', status: 'PENDING', attemptCount: 3, retryPhase: 'SHORT_TERM', nextAttemptAt: '2026-09-30T14:40:00', retryExpiresAt: '2026-10-14T00:00:00' },
    ]);
    expect(channel).toMatchObject({ failedWatchersTotal: 12, watcherPage: 1, watcherSize: 5 });
    // total absent → the page length
    expect(toCollaborationChannel({ status: 'CREATED', failed_watchers: [{ username: 'a', status: 'FAILED' }] })?.failedWatchersTotal).toBe(1);
  });

  it('manual retry fields: false/null by default, parsed when sent', () => {
    expect(toCollaborationChannel({ status: 'RETRYING' })).toMatchObject({ manualRetryPending: false, manualRetryRequestedAt: null });
    expect(
      toCollaborationChannel({ status: 'RETRYING', manual_retry_pending: true, manual_retry_requested_at: '2026-09-30T15:02:00' }),
    ).toMatchObject({ manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' });
    expect(toCollaborationChannel({ status: 'RETRYING', manual_retry_pending: 'yes' })?.manualRetryPending).toBe(false);
  });

  it('datetimes are cut to MM-DD HH:mm, never converted', () => {
    expect(localClock('2026-09-30T14:20:00.123456')).toBe('09-30 14:20');
    expect(localClock('2026-10-01T00:50:00')).toBe('10-01 00:50');
    expect(localClock(null)).toBeNull();
    expect(localClock('garbage')).toBeNull();
  });
});
