import { describe, expect, it } from 'vitest';
import {
  clearNlbDraft,
  dirtyCount,
  effectiveNlbIndex,
  isNlbDirty,
  nlbOptionDisabled,
  setNlbDraft,
  type NlbDraft,
} from '@/app/admin/pipelines/queue/requests/_logic';
import { toRequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const row = (over: Partial<RequestResourceRow> = {}): RequestResourceRow => ({
  resourceId: 'r-1',
  selected: true,
  exclusionReason: null,
  databaseType: 'Oracle',
  region: null,
  idcKind: 'IP',
  connectTargets: ['10.20.1.11'],
  port: 1521,
  oracleSid: 'ORCLPDB1',
  sourceIps: ['10.20.9.1'],
  nlbIndex: 3,
  ...over,
});

describe('NLB draft reducer', () => {
  it('effectiveNlbIndex prefers the draft over the original index', () => {
    const draft: NlbDraft = { 'r-1': 5 };
    expect(effectiveNlbIndex(row(), draft)).toBe(5);
    expect(effectiveNlbIndex(row(), {})).toBe(3);
  });

  it('setNlbDraft records a change and clears it when chosen === original', () => {
    const changed = setNlbDraft({}, row(), 5);
    expect(changed).toEqual({ 'r-1': 5 });
    // Choosing the original index back removes the draft entry (not dirty).
    expect(setNlbDraft(changed, row(), 3)).toEqual({});
  });

  it('isNlbDirty only when the draft differs from the original', () => {
    expect(isNlbDirty(row(), { 'r-1': 5 })).toBe(true);
    expect(isNlbDirty(row(), { 'r-1': 3 })).toBe(false);
    expect(isNlbDirty(row(), {})).toBe(false);
  });

  it('clearNlbDraft drops one row after a successful save', () => {
    expect(clearNlbDraft({ 'r-1': 5, 'r-2': 2 }, 'r-1')).toEqual({ 'r-2': 2 });
  });

  it('dirtyCount counts only rows whose draft differs from original', () => {
    const rows = [row({ resourceId: 'r-1', nlbIndex: 3 }), row({ resourceId: 'r-2', nlbIndex: 2 })];
    expect(dirtyCount(rows, { 'r-1': 5, 'r-2': 2 })).toBe(1);
  });

  it('nlbOptionDisabled blocks Hard-Limit indices except the current one', () => {
    expect(nlbOptionDisabled(55, 4, 3)).toBe(true); // full, not current
    expect(nlbOptionDisabled(55, 4, 4)).toBe(false); // full but current → selectable
    expect(nlbOptionDisabled(28, 2, 3)).toBe(false); // under capacity
  });
});

describe('toRequestResourceRow (wire → domain)', () => {
  it('maps an IDC IP resource, coalescing metadata', () => {
    const mapped = toRequestResourceRow({
      resource_id: 'idc-r-8f21',
      selected: true,
      metadata: {
        database_type: 'Oracle',
        idc_host_format: 'IP',
        idc_ips: ['10.20.1.11', '10.20.1.12'],
        idc_source_ips: ['10.20.9.1'],
        port: 1521,
        oracle_service_id: 'ORCLPDB1',
        nlb_index: 3,
      },
    });
    expect(mapped).toMatchObject({
      resourceId: 'idc-r-8f21',
      selected: true,
      idcKind: 'IP',
      connectTargets: ['10.20.1.11', '10.20.1.12'],
      port: 1521,
      oracleSid: 'ORCLPDB1',
      sourceIps: ['10.20.9.1'],
      nlbIndex: 3,
    });
  });

  it('maps an IDC HOST resource to [host]', () => {
    const mapped = toRequestResourceRow({
      resource_id: 'idc-r-8f22',
      selected: true,
      metadata: { idc_host_format: 'HOST', idc_host: 'db.prod.internal', database_type: 'MySQL' },
    });
    expect(mapped.idcKind).toBe('HOST');
    expect(mapped.connectTargets).toEqual(['db.prod.internal']);
  });

  it('treats an excluded resource (selected=false) with its reason', () => {
    const mapped = toRequestResourceRow({
      resource_id: 'r-x',
      selected: false,
      exclusion_reason: '개발(dev) 인스턴스',
      metadata: { database_type: 'MySQL' },
    });
    expect(mapped.selected).toBe(false);
    expect(mapped.exclusionReason).toBe('개발(dev) 인스턴스');
    expect(mapped.idcKind).toBeNull();
    expect(mapped.connectTargets).toEqual([]);
  });

  it('defaults selected to true when absent without an exclusion reason', () => {
    const mapped = toRequestResourceRow({ resource_id: 'r-c', metadata: { region: 'ap-northeast-2' } });
    expect(mapped.selected).toBe(true);
    expect(mapped.region).toBe('ap-northeast-2');
  });
});
