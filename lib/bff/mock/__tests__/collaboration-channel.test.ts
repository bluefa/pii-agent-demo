/**
 * Collaboration channel mock (assumed §4 · §12) — the (service, cloud) unit is what a
 * retry resolves, the ticket-failed list and the summary count read the same store, and
 * the service × provider jira mapping (what the watcher POST reads) is the same truth.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MANUAL_RETRY_DEMO_MS, mockCollaborationChannel, mockServiceJiraTickets } from '@/lib/bff/mock/ops';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';

const reset = () => {
  const g = globalThis as { __opsCollaborationChannelStore?: unknown; __opsConsoleServiceStore?: unknown };
  delete g.__opsCollaborationChannelStore;
  // The service × provider mapping seeds itself from the channel store — reset both.
  delete g.__opsConsoleServiceStore;
};

const ticketKeys = async (code: string): Promise<Record<string, string>> => {
  const list = (await (await mockServiceJiraTickets.list(code)).json()) as { cloudProvider: string; issueKey: string }[];
  return Object.fromEntries(list.map((t) => [t.cloudProvider, t.issueKey]));
};

const ticketFailedIds = async (): Promise<number[]> => {
  const res = await mockTaskQueue.getAlertTargetSources({ kind: 'jira-ticket-failed', page: 0, size: 10 });
  const body = (await res.json()) as { content: { targetSourceId: number }[] };
  return body.content.map((r) => r.targetSourceId);
};

const summary = async () =>
  (await (await mockTaskQueue.getDashboardSummary()).json()) as {
    jira_ticket_failed_count: number;
    jira_watcher_failed_count: number;
  };

const channelOf = async (ts: number) =>
  (await (await mockCollaborationChannel.get(ts)).json()) as Record<string, unknown>;

beforeEach(reset);

describe('collaboration channel mock', () => {
  it('seeds four ticket-failed rows (none CREATED) and two watcher rows; NONE echoes an empty watcher page', async () => {
    expect(await ticketFailedIds()).toEqual([2113, 2114, 1099, 1980]);
    expect(await summary()).toMatchObject({ jira_ticket_failed_count: 4, jira_watcher_failed_count: 2 });

    const res = await mockTaskQueue.getAlertTargetSources({ kind: 'jira-watcher-failed', page: 0, size: 10 });
    const body = (await res.json()) as { content: Record<string, unknown>[] };
    expect(body.content).toHaveLength(2);
    // who failed is NOT on the row
    expect('failed_watchers' in body.content[0]).toBe(false);

    expect(await channelOf(1099)).toMatchObject({ status: 'FAILED', retry_expires_at: '2026-09-28T00:00:00' });
    expect(await channelOf(4242)).toMatchObject({
      status: 'NONE', issue_key: null, failed_watchers: [], failed_watchers_total: 0, watcher_page: 0, watcher_size: 10,
      manual_retry_pending: false, manual_retry_requested_at: null,
    });
  });

  it('retry phases: PAY/AWS SHORT_TERM (2/6), MBR/GCP LONG_TERM (6, max null)', async () => {
    expect(await channelOf(2113)).toMatchObject({ status: 'RETRYING', attempt_count: 2, max_attempts: 6, retry_phase: 'SHORT_TERM' });
    expect(await channelOf(1980)).toMatchObject({
      status: 'RETRYING', attempt_count: 6, max_attempts: null, retry_phase: 'LONG_TERM',
      next_attempt_at: '2026-10-01T00:50:00', retry_expires_at: '2026-10-14T00:00:00',
    });
  });

  it('watchers ride the channel GET per ticket unit, paginated and username asc', async () => {
    const stl = (await channelOf(1861)) as { failed_watchers: { username: string; status: string }[]; failed_watchers_total: number };
    expect(stl.failed_watchers.map((w) => w.username)).toEqual(['hong.gildong', 'kim.cs']);
    expect(stl.failed_watchers.map((w) => w.status)).toEqual(['FAILED', 'PENDING']);
    expect(stl.failed_watchers_total).toBe(2);

    const dlv0 = (await channelOf(1799)) as { failed_watchers: { username: string }[]; failed_watchers_total: number; watcher_page: number };
    // server default page size is the contract's 10; the console asks for 5 explicitly
    expect(dlv0.failed_watchers).toHaveLength(10);
    expect(dlv0).toMatchObject({ failed_watchers_total: 12, watcher_page: 0 });
    const dlv2 = (await (await mockCollaborationChannel.get(1799, { watcherPage: 2, watcherSize: 5 })).json()) as {
      failed_watchers: { username: string }[]; watcher_page: number; watcher_size: number;
    };
    expect(dlv2.failed_watchers).toHaveLength(2);
    expect(dlv2).toMatchObject({ watcher_page: 2, watcher_size: 5 });
    const names = [...dlv0.failed_watchers, ...dlv2.failed_watchers].map((w) => w.username);
    expect(names).toEqual([...names].sort());
  });

  it('manual retry: 202 marks the unit pending, then the demo flips the whole unit to CREATED and maps the ticket', async () => {
    vi.useFakeTimers();
    try {
      const res = await mockCollaborationChannel.retry(2113);
      expect(res.status).toBe(202);
      const pending = await channelOf(2114);
      expect(pending).toMatchObject({ status: 'RETRYING', manual_retry_pending: true });
      expect(typeof pending.manual_retry_requested_at).toBe('string');
      // a second request while pending
      const busy = await mockCollaborationChannel.retry(2113);
      expect(busy.status).toBe(409);
      expect(((await busy.json()) as { error: string }).error).toBe('JIRA_MANUAL_RETRY_BUSY');

      await vi.advanceTimersByTimeAsync(MANUAL_RETRY_DEMO_MS);
      const done = (await channelOf(2114)) as { status: string; issue_key: string; manual_retry_pending: boolean };
      expect(done.status).toBe('CREATED');
      expect(done.manual_retry_pending).toBe(false);
      expect(await ticketFailedIds()).toEqual([1099, 1980]);
      expect((await summary()).jira_ticket_failed_count).toBe(2);
      expect(await ticketKeys('PAY')).toEqual({ AWS: done.issue_key });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retry hooks: CREATED → UNAVAILABLE, unknown target → NOT_FOUND, 1099 → DISABLED', async () => {
    const unavailable = await mockCollaborationChannel.retry(1861);
    expect(unavailable.status).toBe(409);
    expect(((await unavailable.json()) as { error: string }).error).toBe('JIRA_MANUAL_RETRY_UNAVAILABLE');

    const notFound = await mockCollaborationChannel.retry(4242);
    expect(notFound.status).toBe(404);
    expect(((await notFound.json()) as { error: string }).error).toBe('JIRA_TICKET_NOT_FOUND');

    const disabled = await mockCollaborationChannel.retry(1099);
    expect(disabled.status).toBe(503);
    expect(((await disabled.json()) as { error: string }).error).toBe('JIRA_MANUAL_RETRY_DISABLED');
  });

  it('the service × provider mapping is the same truth: seeded from CREATED units, mirrored both ways', async () => {
    expect(await ticketKeys('STL')).toEqual({ AWS: 'BDCDIP-2211' });
    expect(await ticketKeys('DLV')).toEqual({ AZURE: 'BDCDIP-1799' });
    expect(await ticketKeys('PAY')).toEqual({});

    // attach on the service axis lands on every channel row of the unit
    await mockServiceJiraTickets.attach('PAY', 'AWS', 'BDCDIP-500');
    expect((await channelOf(2114)).issue_key).toBe('BDCDIP-500');
    expect(await ticketFailedIds()).toEqual([1099, 1980]);

    // SDU units map under provider SDU, not the CSP underneath
    await mockServiceJiraTickets.attach('SDU', 'SDU', 'BDCDIP-77');
    expect((await channelOf(1099)).issue_key).toBe('BDCDIP-77');

    await mockServiceJiraTickets.detach('DLV', 'AZURE');
    expect((await channelOf(1799)).status).toBe('NONE');
  });

  it('addWatcher succeeds for the DLV/AZURE fixture (the ticket the console shows is mapped)', async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9); // skip the demo's 30% failure
    try {
      const pending = mockServiceJiraTickets.addWatcher('DLV', 'AZURE', 'bae.jh');
      await vi.advanceTimersByTimeAsync(2000);
      expect((await pending).status).toBe(204);
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
});
