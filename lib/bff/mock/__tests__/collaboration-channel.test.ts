/**
 * Collaboration channel mock (assumed §4 · §12) — the (service, cloud) unit is what a
 * PUT links, the ticket-failed list and the summary count read the same store, and the
 * two 409s are told apart by code.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { mockCollaborationChannel } from '@/lib/bff/mock/ops';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';

const reset = () => {
  delete (globalThis as { __opsCollaborationChannelStore?: unknown }).__opsCollaborationChannelStore;
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

beforeEach(reset);

describe('collaboration channel mock', () => {
  it('seeds four ticket-failed rows (none CREATED) and two watcher rows with failed_watchers', async () => {
    expect(await ticketFailedIds()).toEqual([2113, 2114, 1099, 1980]);
    expect(await summary()).toMatchObject({ jira_ticket_failed_count: 4, jira_watcher_failed_count: 2 });

    const res = await mockTaskQueue.getAlertTargetSources({ kind: 'jira-watcher-failed', page: 0, size: 10 });
    const body = (await res.json()) as { content: Record<string, unknown>[] };
    expect(body.content).toHaveLength(2);
    // who failed is NOT on the row any more
    expect('failed_watchers' in body.content[0]).toBe(false);

    const sdu = (await (await mockCollaborationChannel.get(1099)).json()) as { status: string; retry_expires_at: string };
    expect(sdu).toMatchObject({ status: 'FAILED', retry_expires_at: '2026-09-28T00:00:00' });
    const none = (await (await mockCollaborationChannel.get(4242)).json()) as Record<string, unknown>;
    expect(none).toMatchObject({ status: 'NONE', issue_key: null, failed_watchers: [], failed_watchers_total: 0, watcher_page: 0, watcher_size: 10 });
  });

  it('retry phases: PAY/AWS SHORT_TERM (2/6), MBR/GCP LONG_TERM (6, max null)', async () => {
    const pay = (await (await mockCollaborationChannel.get(2113)).json()) as Record<string, unknown>;
    expect(pay).toMatchObject({ status: 'RETRYING', attempt_count: 2, max_attempts: 6, retry_phase: 'SHORT_TERM' });
    const mbr = (await (await mockCollaborationChannel.get(1980)).json()) as Record<string, unknown>;
    expect(mbr).toMatchObject({
      status: 'RETRYING', attempt_count: 6, max_attempts: null, retry_phase: 'LONG_TERM',
      next_attempt_at: '2026-10-01T00:50:00', retry_expires_at: '2026-10-14T00:00:00',
    });
  });

  it('watchers ride the channel GET per ticket unit, paginated and username asc', async () => {
    const stl = (await (await mockCollaborationChannel.get(1861)).json()) as {
      failed_watchers: { username: string; status: string }[]; failed_watchers_total: number;
    };
    expect(stl.failed_watchers.map((w) => w.username)).toEqual(['hong.gildong', 'kim.cs']);
    expect(stl.failed_watchers.map((w) => w.status)).toEqual(['FAILED', 'PENDING']);
    expect(stl.failed_watchers_total).toBe(2);

    const dlv0 = (await (await mockCollaborationChannel.get(1799)).json()) as {
      failed_watchers: { username: string }[]; failed_watchers_total: number; watcher_page: number; watcher_size: number;
    };
    expect(dlv0.failed_watchers).toHaveLength(10);
    expect(dlv0).toMatchObject({ failed_watchers_total: 12, watcher_page: 0, watcher_size: 10 });
    const dlv1 = (await (await mockCollaborationChannel.get(1799, { watcherPage: 1, watcherSize: 10 })).json()) as {
      failed_watchers: { username: string }[]; watcher_page: number;
    };
    expect(dlv1.failed_watchers).toHaveLength(2);
    expect(dlv1.watcher_page).toBe(1);
    const names = [...dlv0.failed_watchers, ...dlv1.failed_watchers].map((w) => w.username);
    expect(names).toEqual([...names].sort());
  });

  it('PUT links the whole (service, cloud) unit and both rows leave the list', async () => {
    const res = await mockCollaborationChannel.put(2113, { issue_key: 'BDCDIP-1234' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'CREATED',
      issue_key: 'BDCDIP-1234',
      url: 'https://jira.sec.samsung.net/browse/BDCDIP-1234',
    });
    const sibling = (await (await mockCollaborationChannel.get(2114)).json()) as { status: string };
    expect(sibling.status).toBe('CREATED');
    expect(await ticketFailedIds()).toEqual([1099, 1980]);
    expect((await summary()).jira_ticket_failed_count).toBe(2);
  });

  it('BDCDIP-409 answers the in-progress 409; a different key on a CREATED target is a plain 409', async () => {
    const busy = await mockCollaborationChannel.put(1980, { issue_key: 'BDCDIP-409' });
    expect(busy.status).toBe(409);
    expect(((await busy.json()) as { error: string }).error).toBe('JIRA_TICKET_CREATION_IN_PROGRESS');

    const taken = await mockCollaborationChannel.put(1861, { issue_key: 'BDCDIP-9999' });
    expect(taken.status).toBe(409);
    expect(((await taken.json()) as { error: string }).error).toBe('CONFLICT');

    const empty = await mockCollaborationChannel.put(1980, { issue_key: '  ' });
    expect(empty.status).toBe(400);
  });
});
