/**
 * 운영 알림 aggregation + the invariant it depends on
 * (docs/api/ops-assumed-contracts.md §7).
 *
 * The point of these tests is that the aggregation is the SERVER's. If any of
 * it drifts back to the client, one of these fails.
 */
import { describe, expect, it } from 'vitest';

import { mockOps } from '@/lib/bff/mock/ops';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { mockProjects } from '@/lib/mock-data';
import type { OpsAlertsResponseWire } from '@/lib/bff/types';

const alerts = async (kind?: string, page = 0, size = 100): Promise<OpsAlertsResponseWire> =>
  (await mockOps.getAlerts(kind, page, size)).json();

describe('ops alerts (assumed §7)', () => {
  it('a Test Connection queue row always resolves to a target source', async () => {
    // The invariant 운영 알림 relies on: a TC alert deep-links to that target's
    // 운영 화면 (?tab=tc), so a queue row with no project would be a dead link.
    const seeded = new Set(mockProjects.map((project) => project.targetSourceId));

    for (const status of ['TEST_CONNECTION_COMPLETED', 'TEST_CONNECTION_REJECTED']) {
      const page = await (
        await mockTaskQueue.getTestConnectionPage({ status, page: 0, size: 200 })
      ).json();
      const rows = page.content as { target_source_id: number }[];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(seeded.has(row.target_source_id)).toBe(true);
      }
    }
  });

  it('counts cover the whole population, not the returned page', async () => {
    const firstPage = await alerts(undefined, 0, 1);
    const everything = await alerts(undefined, 0, 500);

    expect(firstPage.alerts.content).toHaveLength(1);
    // Paging must not shrink a single count.
    expect(firstPage.counts).toEqual(everything.counts);
    expect(firstPage.alerts.totalElements).toBe(everything.alerts.totalElements);
  });

  it('counts are unaffected by the kind filter', async () => {
    const unfiltered = await alerts();
    const filtered = await alerts('PENDING');
    expect(filtered.counts).toEqual(unfiltered.counts);
  });

  it('each count equals the number of rows that filter returns', async () => {
    const { counts } = await alerts();
    for (const [kind, count] of Object.entries(counts)) {
      const page = await alerts(kind, 0, 500);
      expect(page.alerts.totalElements).toBe(count);
    }
  });

  it('surfaces 재실행 요청 rows, which match no process status', async () => {
    const page = await alerts('TC_REJECTED', 0, 500);
    expect(page.alerts.totalElements).toBeGreaterThan(0);
    for (const row of page.alerts.content) {
      expect(row.alert_kinds).toContain('TC_REJECTED');
      // Rejecting rolls the target back, so it is NOT CONNECTED any more.
      expect(row.process_status).not.toBe('CONNECTED');
    }
  });

  it('gives every row at least one kind, and can give it several', async () => {
    const page = await alerts(undefined, 0, 500);
    expect(page.alerts.content.length).toBeGreaterThan(0);
    for (const row of page.alerts.content) {
      expect(row.alert_kinds.length).toBeGreaterThan(0);
    }
    expect(page.alerts.content.some((row) => row.alert_kinds.length > 1)).toBe(true);
  });

  it('orders rows oldest-first across the whole population', async () => {
    const page = await alerts(undefined, 0, 500);
    const times = page.alerts.content.map((row) => row.last_changed_at);
    expect([...times].sort((a, b) => a.localeCompare(b))).toEqual(times);
  });
});
