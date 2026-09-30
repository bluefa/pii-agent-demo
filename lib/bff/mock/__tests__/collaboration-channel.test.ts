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
    const body = (await res.json()) as { content: { failed_watchers?: unknown[]; metadata: { is_sdu_type: boolean } }[] };
    expect(body.content).toHaveLength(2);
    expect(body.content[0].failed_watchers).toHaveLength(2);

    const sdu = (await (await mockCollaborationChannel.get(1099)).json()) as { status: string };
    expect(sdu.status).toBe('FAILED');
    const none = (await (await mockCollaborationChannel.get(4242)).json()) as { status: string; issue_key: unknown };
    expect(none).toMatchObject({ status: 'NONE', issue_key: null });
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
