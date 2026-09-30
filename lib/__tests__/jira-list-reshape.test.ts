/**
 * Jira Ticket console readers — the fields that are NOT in the swagger yet
 * (docs/api/ops-assumed-contracts.md §4 · §12) survive the passthrough as values.
 */
import { describe, expect, it } from 'vitest';

import { toDashboardSummary, toJiraListPage } from '@/lib/types/task-queue';
import { nextAttemptClock, toCollaborationChannel } from '@/lib/types/collaboration-channel';

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

describe('toJiraListPage — isSduType and failed_watchers', () => {
  it('isSduType comes from metadata.is_sdu_type, strictly true', () => {
    expect(firstRow({ ...ROW, metadata: { is_sdu_type: true } }).isSduType).toBe(true);
    expect(firstRow({ ...ROW, metadata: { is_sdu_type: 'true' } }).isSduType).toBe(false);
    expect(firstRow(ROW).isSduType).toBe(false);
  });

  it('absent failed_watchers is null, not an empty list', () => {
    expect(firstRow(ROW).failedWatchers).toBeNull();
    expect(firstRow({ ...ROW, failed_watchers: 'nope' }).failedWatchers).toBeNull();
  });

  it('parses entries and drops the malformed ones', () => {
    const row = firstRow({
      ...ROW,
      failed_watchers: [
        { username: 'hong.gildong', status: 'FAILED', attempt_count: 6 },
        { username: 'kim.cs', status: null, attempt_count: '3' },
        { status: 'FAILED' },
        { username: '' },
        null,
      ],
    });
    expect(row.failedWatchers).toEqual([
      { username: 'hong.gildong', status: 'FAILED', attemptCount: 6 },
      { username: 'kim.cs', status: null, attemptCount: null },
    ]);
    // the contract fields ride along
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

  it('next_attempt_at is cut, never converted', () => {
    expect(nextAttemptClock('2026-09-30T14:20:00.123456')).toBe('14:20');
    expect(nextAttemptClock(null)).toBeNull();
    expect(nextAttemptClock('garbage')).toBeNull();
  });
});
