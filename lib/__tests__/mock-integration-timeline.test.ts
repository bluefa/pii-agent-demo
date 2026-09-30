/**
 * 연동 시점 mock — the endpoint's work is done on the SERVER side of the mock.
 *
 * The screen sends every filter and draws whatever comes back, so if the mock ignored one
 * the demo would look correct only because the table happened to hold few rows. These
 * check the cuts the api-spec declares, against the real target-source seeds.
 */
import { describe, expect, it } from 'vitest';

import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import type {
  IntegrationTimelineCsvQuery,
  IntegrationTimelineQuery,
  IntegrationTimelineWire,
} from '@/lib/types/task-queue';

const query = (over: Partial<IntegrationTimelineQuery> = {}): IntegrationTimelineQuery => ({
  axis: 'CREATED',
  from: '2000-01-01',
  to: '2100-01-01',
  installed: 'ALL',
  sort: 'createdAt,desc',
  page: 0,
  size: 100,
  ...over,
});

interface WirePage {
  content: IntegrationTimelineWire[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const read = async (over: Partial<IntegrationTimelineQuery> = {}): Promise<WirePage> =>
  (await (await mockTaskQueue.getIntegrationTimeline(query(over))).json()) as WirePage;

describe('mock 연동 시점', () => {
  it('holds both kinds of row — finished and not', async () => {
    const page = await read();
    const installed = page.content.filter((row) => row.pii_agent_first_installed_at);
    expect(installed.length).toBeGreaterThan(0);
    expect(page.content.length).toBeGreaterThan(installed.length);
  });

  it('computes lead_time_seconds only where there is a first integration', async () => {
    for (const row of (await read()).content) {
      if (row.pii_agent_first_installed_at) {
        expect(typeof row.lead_time_seconds).toBe('number');
      } else {
        expect(row.lead_time_seconds).toBeNull();
      }
    }
  });

  it('cuts on the axis the query names', async () => {
    const created = await read({ axis: 'CREATED', from: '2026-01-01', to: '2026-12-31' });
    for (const row of created.content) {
      expect(row.created_at?.slice(0, 10) ?? '').toMatch(/^2026-/);
    }
    // FIRST_INSTALLED can only contain rows that have one.
    const first = await read({ axis: 'FIRST_INSTALLED' });
    expect(first.content.every((row) => row.pii_agent_first_installed_at)).toBe(true);
  });

  it('answers an empty page for the combination that cannot exist', async () => {
    // axis=FIRST_INSTALLED with installed=NO is defined as empty, not a 400 (api-spec §P6).
    const page = await read({ axis: 'FIRST_INSTALLED', installed: 'NO' });
    expect(page.content).toEqual([]);
    expect(page.totalElements).toBe(0);
  });

  it('filters on 최초 연동 여부', async () => {
    expect((await read({ installed: 'YES' })).content.every((r) => r.pii_agent_first_installed_at))
      .toBe(true);
    expect((await read({ installed: 'NO' })).content.every((r) => !r.pii_agent_first_installed_at))
      .toBe(true);
  });

  it('sorts on the server', async () => {
    const ids = (await read({ sort: 'targetSourceId,asc' })).content.map((r) => r.target_source_id);
    expect(ids).toEqual([...ids].sort((a, b) => (a ?? 0) - (b ?? 0)));

    const leads = (await read({ sort: 'leadTimeSeconds,desc', installed: 'YES' })).content.map(
      (r) => r.lead_time_seconds ?? 0,
    );
    expect(leads).toEqual([...leads].sort((a, b) => b - a));
  });

  it('pages on the server', async () => {
    const all = await read({ size: 100 });
    const firstPage = await read({ size: 5, page: 0 });
    const secondPage = await read({ size: 5, page: 1 });
    expect(firstPage.content).toHaveLength(5);
    expect(firstPage.totalElements).toBe(all.totalElements);
    expect(secondPage.number).toBe(1);
    expect(secondPage.content[0]?.target_source_id).not.toBe(firstPage.content[0]?.target_source_id);
  });

  it('writes the CSV in the column order the spec fixes', async () => {
    const csvQuery: IntegrationTimelineCsvQuery = {
      axis: 'CREATED',
      from: '2000-01-01',
      to: '2100-01-01',
      installed: 'YES',
      sort: 'targetSourceId,asc',
    };
    const csv = await mockTaskQueue.getIntegrationTimelineCsv(csvQuery);
    const [header, ...rows] = csv.split('\n');
    expect(header).toBe(
      'target_source_id,service_code,service_name,cloud_provider,confirm_status,created_at,pii_agent_first_installed_at,lead_time_seconds,is_sdu_type,is_china_region',
    );
    // No pager on a download: every row the filter matched is in the file.
    const page = await read({ ...csvQuery, size: 100, page: 0 });
    expect(rows).toHaveLength(page.totalElements);
  });
});
