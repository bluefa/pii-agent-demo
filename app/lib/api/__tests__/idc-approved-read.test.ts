import { describe, it, expect } from 'vitest';
import {
  toIdcResourceViewFromExcluded,
  toIdcResourceViewFromSnapshot,
} from '@/app/lib/api/idc';
import type { ResourceSnapshot } from '@/lib/types';

/**
 * The read-back half of the LIN-52 round-trip: Step 1 sends every row's connection info under
 * `metadata` (idc-approval-input.test.ts covers the request), and steps 2·3 have to show it again.
 * Both adapters used to read an `endpoint_config` object that no contract declares, so the
 * request was fine and the screen was blank.
 */
describe('IDC approved-integration read adapters', () => {
  it('reads the connection info from metadata', () => {
    const wire = {
      resource_id: 'idc-res-001',
      resource_type: 'IDC_RESOURCE',
      credential_id: 'Key2',
      metadata: {
        provider: 'IDC',
        database_type: 'MYSQL',
        port: 3306,
        oracle_service_id: null,
      },
      idc_host_format: 'IP',
      idc_ips: ['10.20.30.40'],
    } as ResourceSnapshot;

    const view = toIdcResourceViewFromSnapshot(wire);

    expect(view.port).toBe(3306);
    expect(view.databaseTypeLabel).toBe('MySQL');
    expect(view.hosts).toEqual(['10.20.30.40']);
  });

  // An excluded row is the same wire object with `selected: false`, so its endpoint rides along.
  it('keeps an excluded row’s host and port', () => {
    const view = toIdcResourceViewFromExcluded({
      resource_id: 'idc-res-006',
      exclusion_reason: 'StageDB',
      database_type: 'POSTGRESQL',
      metadata: { database_type: 'POSTGRESQL', port: 5432 },
      idc_host_format: 'HOST',
      idc_host: 'db.svc-a.io',
    });

    expect(view.excluded).toBe(true);
    expect(view.exclusionReason).toBe('StageDB');
    expect(view.kind).toBe('DOMAIN');
    expect(view.hosts).toEqual(['db.svc-a.io']);
    expect(view.port).toBe(5432);
    expect(view.databaseTypeLabel).toBe('PostgreSQL');
  });

  // Older payloads carry only id/reason/type — the table renders — rather than a fabricated value.
  it('leaves hosts empty and port 0 when the payload reports no endpoint', () => {
    const view = toIdcResourceViewFromExcluded({
      resource_id: 'idc-res-007',
      exclusion_reason: '캐시 전용',
      database_type: 'REDIS',
    });

    expect(view.hosts).toEqual([]);
    expect(view.port).toBe(0);
    expect(view.databaseTypeLabel).toBe('Redis');
  });
});
