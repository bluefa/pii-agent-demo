import { describe, it, expect } from 'vitest';
import { toTcResultRow, type TcResultRow } from '@/app/lib/api/task-queue-tc';
import {
  tcResultStats,
  ldbCount,
  putLdbCache,
  type LdbCache,
} from '@/app/admin/pipelines/queue/test-connections/_tc/logic';

const row = (over: Partial<TcResultRow> = {}): TcResultRow => ({
  resourceId: 'r-1',
  databaseType: 'MYSQL',
  connectionTarget: 'db-1',
  includedCount: 5,
  excludedCount: 2,
  connectionStatus: 'SUCCESS',
  ...over,
});

describe('toTcResultRow', () => {
  it('reads contract fields and enriched passthrough fields', () => {
    expect(
      toTcResultRow({
        resource_id: 'idc-r-1',
        logical_database_count: 6,
        excluded_logical_database_count: 1,
        database_type: 'ORACLE',
        connection_target: '10.20.4.18',
        connection_status: 'SUCCESS',
      }),
    ).toEqual({
      resourceId: 'idc-r-1',
      databaseType: 'ORACLE',
      connectionTarget: '10.20.4.18',
      includedCount: 6,
      excludedCount: 1,
      connectionStatus: 'SUCCESS',
    });
  });

  it('falls back to "—"-able nulls and SUCCESS when the thin summary omits fields', () => {
    expect(
      toTcResultRow({ resource_id: 'r', logical_database_count: 3, excluded_logical_database_count: 0 }),
    ).toEqual({
      resourceId: 'r',
      databaseType: null,
      connectionTarget: null,
      includedCount: 3,
      excludedCount: 0,
      connectionStatus: 'SUCCESS',
    });
  });

  it('maps FAIL / FAILED (any case) to FAILED', () => {
    expect(toTcResultRow({ connection_status: 'FAIL' }).connectionStatus).toBe('FAILED');
    expect(toTcResultRow({ connection_status: 'failed' }).connectionStatus).toBe('FAILED');
  });

  it('coalesces absent counts to 0 and absent id to empty string', () => {
    expect(toTcResultRow({})).toEqual({
      resourceId: '',
      databaseType: null,
      connectionTarget: null,
      includedCount: 0,
      excludedCount: 0,
      connectionStatus: 'SUCCESS',
    });
  });
});

describe('tcResultStats', () => {
  it('sums counts and rows', () => {
    expect(
      tcResultStats([
        row({ includedCount: 5, excludedCount: 2 }),
        row({ includedCount: 3, excludedCount: 1 }),
      ]),
    ).toEqual({ resourceCount: 2, includedTotal: 8, excludedTotal: 3 });
  });

  it('is empty for no rows', () => {
    expect(tcResultStats([])).toEqual({ resourceCount: 0, includedTotal: 0, excludedTotal: 0 });
  });
});

describe('ldbCount', () => {
  it('returns the tab count for a SUCCESS row', () => {
    expect(ldbCount(row(), 'inc')).toBe(5);
    expect(ldbCount(row(), 'exc')).toBe(2);
  });

  it('returns null (renders "—", no link) for a FAILED row', () => {
    expect(ldbCount(row({ connectionStatus: 'FAILED' }), 'inc')).toBeNull();
    expect(ldbCount(row({ connectionStatus: 'FAILED' }), 'exc')).toBeNull();
  });
});

describe('putLdbCache', () => {
  it('immutably adds an entry without mutating the input', () => {
    const cache: LdbCache = {};
    const next = putLdbCache(cache, 'r-1', { included: [], excluded: [] });
    expect(cache).toEqual({});
    expect(next['r-1']).toEqual({ included: [], excluded: [] });
  });

  it('overwrites the same resource key', () => {
    const first = putLdbCache({}, 'r-1', { included: [{ databaseName: 'a' }], excluded: [] });
    const second = putLdbCache(first, 'r-1', { included: [], excluded: [] });
    expect(second['r-1'].included).toEqual([]);
  });
});
