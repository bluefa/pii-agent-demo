/**
 * `toIntegrationTimelinePage` — the wire→domain hop for a contract gap (G8).
 *
 * There is no generated schema behind this endpoint, so nothing but this adapter and its
 * hand-written wire type stand between an upstream rename and a column that silently goes
 * empty. Pinned by value for that reason.
 */
import { describe, expect, it } from 'vitest';

import {
  toIntegrationTimelinePage,
  type IntegrationTimelinePageWire,
} from '@/lib/types/task-queue';

const page = (content: IntegrationTimelinePageWire['content']): IntegrationTimelinePageWire => ({
  content,
  totalElements: 41,
  totalPages: 3,
  number: 0,
  size: 20,
  first: true,
  last: false,
  numberOfElements: content?.length ?? 0,
  empty: (content?.length ?? 0) === 0,
});

describe('toIntegrationTimelinePage', () => {
  it('reshapes an installed row into the camel domain', () => {
    const row = toIntegrationTimelinePage(
      page([
        {
          target_source_id: 4130,
          service_code: 'SVC-PAY',
          service_name: '결제 정산',
          cloud_provider: 'AWS',
          confirm_status: 'CONFIRMED',
          created_at: '2026-07-02T10:12:00+09:00',
          pii_agent_first_installed_at: '2026-07-11T16:40:00+09:00',
          lead_time_seconds: 800_880,
        },
      ]),
    ).content[0];

    expect(row).toEqual({
      targetSourceId: 4130,
      serviceCode: 'SVC-PAY',
      serviceName: '결제 정산',
      cloudProvider: 'AWS',
      isSduType: false,
      isChinaRegion: false,
      confirmStatus: 'CONFIRMED',
      createdAt: '2026-07-02T10:12:00+09:00',
      piiAgentFirstInstalledAt: '2026-07-11T16:40:00+09:00',
      leadTimeSeconds: 800_880,
    });
  });

  it('keeps the offset the server sent — the dates are carried, not converted', () => {
    const row = toIntegrationTimelinePage(
      page([{ created_at: '2026-07-02T00:30:00+09:00' }]),
    ).content[0];
    expect(row.createdAt).toBe('2026-07-02T00:30:00+09:00');
  });

  it('reads a target that has never finished as null, not 0', () => {
    const row = toIntegrationTimelinePage(
      page([{ target_source_id: 7, pii_agent_first_installed_at: null, lead_time_seconds: null }]),
    ).content[0];
    expect(row.piiAgentFirstInstalledAt).toBeNull();
    // 0 would render as '1시간 미만' — a duration for a thing that never happened.
    expect(row.leadTimeSeconds).toBeNull();
  });

  it('carries the page envelope', () => {
    const paged = toIntegrationTimelinePage(page([{ target_source_id: 1 }]));
    expect(paged).toMatchObject({ totalElements: 41, totalPages: 3, number: 0, size: 20 });
  });

  it('survives an empty page', () => {
    const paged = toIntegrationTimelinePage(page([]));
    expect(paged.content).toEqual([]);
    expect(paged.empty).toBe(true);
  });
});
