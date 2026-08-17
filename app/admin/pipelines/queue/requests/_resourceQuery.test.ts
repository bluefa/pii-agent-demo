import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import {
  axisOptions,
  databaseTypeOptions,
  EMPTY_RESOURCE_QUERY,
  pageResources,
  queryResources,
  resourceCounts,
} from '@/app/admin/pipelines/queue/requests/_resourceQuery';

const row = (over: Partial<RequestResourceRow>): RequestResourceRow => ({
  resourceId: 'res-1',
  resourceName: 'aurora-pay-prod',
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'MySQL',
  region: 'ap-northeast-2',
  idcKind: null,
  connectTargets: [],
  port: null,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...over,
});

const cloudRows = [
  row({ resourceId: 'arn:a', resourceName: 'aurora-pay-prod' }),
  row({ resourceId: 'arn:b', resourceName: 'pay-redshift-main', databaseType: 'Redshift', region: 'us-east-1' }),
  row({ resourceId: 'arn:c', resourceName: 'pay-rds-proxy', selected: false, exclusionReason: 'RDS Proxy' }),
];

const idcRows = [
  row({ resourceId: 'idc-1', resourceName: null, idcKind: 'IP', connectTargets: ['10.20.1.11'], oracleSid: 'ORCLPDB1', databaseType: 'Oracle', region: null }),
  row({ resourceId: 'idc-2', resourceName: null, idcKind: 'HOST', connectTargets: ['db-mysql.order.prod.internal'], region: null }),
  row({ resourceId: 'idc-3', resourceName: null, idcKind: 'HOST', connectTargets: ['db-mysql.order.dev.internal'], region: null, selected: false, exclusionReason: '개발 인스턴스' }),
];

describe('resourceCounts', () => {
  it('always counts the whole request, never the filtered view', () => {
    expect(resourceCounts(cloudRows)).toEqual({ all: 3, target: 2, excluded: 1 });
  });
});

describe('queryResources', () => {
  it('splits on the 대상/제외 tab', () => {
    const excluded = queryResources(cloudRows, { ...EMPTY_RESOURCE_QUERY, filter: 'excluded' }, false);
    expect(excluded.map((r) => r.resourceName)).toEqual(['pay-rds-proxy']);
  });

  it('narrows to the rows the suspect set names', () => {
    const query = { ...EMPTY_RESOURCE_QUERY, filter: 'suspect' as const };
    expect(queryResources(cloudRows, query, false, new Set([cloudRows[0]]))).toEqual([cloudRows[0]]);
  });

  /**
   * 집합 없이 켜면 전부가 아니라 아무것도 통과하지 않는다. 반대로 열어 두면 ResourceSection
   * 이 집합을 넘기지 않게 된 순간 '확인 필요 0건'이 전체 목록으로 읽히고, 화면은 멀쩡해
   * 보인다 — 필터가 죽었다는 것을 아무것도 말하지 않는다.
   */
  it('passes nothing when the suspect set is missing', () => {
    const query = { ...EMPTY_RESOURCE_QUERY, filter: 'suspect' as const };
    expect(queryResources(cloudRows, query, false)).toEqual([]);
  });

  it('searches the cloud identity (name + Resource ID)', () => {
    const hit = queryResources(cloudRows, { ...EMPTY_RESOURCE_QUERY, search: 'ARN:B' }, false);
    expect(hit.map((r) => r.resourceName)).toEqual(['pay-redshift-main']);
  });

  /** resource_id is never rendered for IDC, so it must not be searchable there. */
  it('searches the IDC identity (host/IP + SID), not the resource id', () => {
    expect(queryResources(idcRows, { ...EMPTY_RESOURCE_QUERY, search: 'orclpdb1' }, true)).toHaveLength(1);
    expect(queryResources(idcRows, { ...EMPTY_RESOURCE_QUERY, search: '10.20.1.11' }, true)).toHaveLength(1);
    expect(queryResources(idcRows, { ...EMPTY_RESOURCE_QUERY, search: 'idc-1' }, true)).toHaveLength(0);
  });

  it('reads the second axis as region for cloud and 구분 for IDC', () => {
    expect(queryResources(cloudRows, { ...EMPTY_RESOURCE_QUERY, axis: 'us-east-1' }, false)).toHaveLength(1);
    expect(queryResources(idcRows, { ...EMPTY_RESOURCE_QUERY, axis: 'HOST' }, true)).toHaveLength(2);
  });

  it('ands the filters together', () => {
    const hit = queryResources(
      idcRows,
      { ...EMPTY_RESOURCE_QUERY, filter: 'target', axis: 'HOST', search: 'order' },
      true,
    );
    expect(hit.map((r) => r.resourceId)).toEqual(['idc-2']);
  });
});

describe('option lists', () => {
  it('offers only the values the request actually has', () => {
    expect(databaseTypeOptions(cloudRows)).toEqual(['MySQL', 'Redshift']);
    expect(axisOptions(cloudRows, false)).toEqual(['ap-northeast-2', 'us-east-1']);
    expect(axisOptions(idcRows, true)).toEqual(['HOST', 'IP']);
    // IDC rows carry no region — a cloud axis over them must come back empty
    // (the select is hidden rather than offering one dead option).
    expect(axisOptions(idcRows, false)).toEqual([]);
  });
});

describe('pageResources', () => {
  const many = Array.from({ length: 23 }, (_, i) => row({ resourceId: `r-${i}` }));

  it('cuts the table to 10 rows', () => {
    const page = pageResources(many, 0);
    expect(page.rows).toHaveLength(10);
    expect(page.totalPages).toBe(3);
  });

  it('clamps past-the-end pages instead of rendering nothing', () => {
    const page = pageResources(many.slice(0, 4), 2);
    expect(page.page).toBe(0);
    expect(page.rows).toHaveLength(4);
  });

  it('reports a single page for an empty result', () => {
    expect(pageResources([], 0)).toEqual({ page: 0, totalPages: 1, rows: [] });
  });
});
