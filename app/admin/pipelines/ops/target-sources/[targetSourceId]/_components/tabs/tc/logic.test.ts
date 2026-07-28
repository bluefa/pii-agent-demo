import { describe, it, expect } from 'vitest';
import { toTcResultRow, type TcResultRow } from '@/app/lib/api/task-queue-tc';
import {
  tcResultStats,
  ldbCount,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import { shortResourceId } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

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

  it('keeps counts but maps an absent status to UNKNOWN (no fabricated Success)', () => {
    expect(
      toTcResultRow({ resource_id: 'r', logical_database_count: 3, excluded_logical_database_count: 0 }),
    ).toEqual({
      resourceId: 'r',
      databaseType: null,
      connectionTarget: null,
      includedCount: 3,
      excludedCount: 0,
      connectionStatus: 'UNKNOWN',
    });
  });

  it('maps FAIL / FAILED (any case) to FAILED', () => {
    expect(toTcResultRow({ connection_status: 'FAIL' }).connectionStatus).toBe('FAILED');
    expect(toTcResultRow({ connection_status: 'failed' }).connectionStatus).toBe('FAILED');
  });

  it('maps an unrecognized status value to UNKNOWN', () => {
    expect(toTcResultRow({ connection_status: 'PENDING' }).connectionStatus).toBe('UNKNOWN');
  });

  it('coalesces absent counts to null, absent id to empty, absent status to UNKNOWN', () => {
    expect(toTcResultRow({})).toEqual({
      resourceId: '',
      databaseType: null,
      connectionTarget: null,
      includedCount: null,
      excludedCount: null,
      connectionStatus: 'UNKNOWN',
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

  it('returns null for an UNKNOWN row (never a false 0)', () => {
    expect(ldbCount(row({ connectionStatus: 'UNKNOWN' }), 'inc')).toBeNull();
    expect(ldbCount(row({ connectionStatus: 'UNKNOWN' }), 'exc')).toBeNull();
  });

  it('returns null for a SUCCESS row whose count the wire omitted', () => {
    expect(ldbCount(row({ includedCount: null }), 'inc')).toBeNull();
    expect(ldbCount(row({ excludedCount: null }), 'exc')).toBeNull();
  });
});

describe('shortResourceId', () => {
  it('leaves a short id untouched', () => {
    expect(shortResourceId('idc-ivt-9a01')).toBe('idc-ivt-9a01');
  });

  it('keeps the last two segments of a long path id', () => {
    expect(
      shortResourceId(
        '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-01',
      ),
    ).toBe('…/servers/mysql-dlv-01');
  });

  it('elides the middle of a long id that has no path segments', () => {
    const value = 'arn'.padEnd(60, 'x');
    const short = shortResourceId(value);
    expect(short).toContain('…');
    expect(short.length).toBeLessThan(value.length);
    expect(short.endsWith(value.slice(-16))).toBe(true);
  });
});
