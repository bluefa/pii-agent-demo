import { describe, expect, it } from 'vitest';
import {
  findResourceMappings,
  nlbOptionDisabled,
} from '@/app/admin/pipelines/queue/requests/_logic';
import { toRequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { ResourceNlbMappings } from '@/app/lib/api/task-queue-requests';

describe('NLB assignment rules', () => {
  it('nlbOptionDisabled blocks Hard-Limit indices except the current one', () => {
    expect(nlbOptionDisabled(55, 4, 3)).toBe(true); // full, not current
    expect(nlbOptionDisabled(55, 4, 4)).toBe(false); // full but current → selectable
    expect(nlbOptionDisabled(28, 2, 3)).toBe(false); // under capacity
  });
});

const mappings: ResourceNlbMappings[] = [
  {
    resourceId: 'idc-r-8f21',
    mappings: [
      { serviceCode: 'ORD', nlbIndex: 3 },
      { serviceCode: 'PAY', nlbIndex: 5 },
    ],
  },
  { resourceId: 'idc-r-8f24', mappings: [] },
];

describe('findResourceMappings', () => {
  it('returns null when the fetch failed (mappings === null)', () => {
    expect(findResourceMappings(null, 'idc-r-8f21')).toBeNull();
  });

  it('returns null when the row has no resource_id key', () => {
    expect(findResourceMappings(mappings, null)).toBeNull();
  });

  it('returns the resource entry mappings when found', () => {
    expect(findResourceMappings(mappings, 'idc-r-8f21')).toEqual([
      { serviceCode: 'ORD', nlbIndex: 3 },
      { serviceCode: 'PAY', nlbIndex: 5 },
    ]);
  });

  it('returns [] for a found-but-empty entry (배정 없음, not a failure)', () => {
    expect(findResourceMappings(mappings, 'idc-r-8f24')).toEqual([]);
  });

  it('returns [] when the resource is absent from a successful fetch', () => {
    expect(findResourceMappings(mappings, 'idc-r-9999')).toEqual([]);
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
