import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import { findDuplicateAddressPairs } from '@/app/admin/pipelines/queue/requests/_duplicateAddress';

const row = (over: Partial<RequestResourceRow>): RequestResourceRow => ({
  resourceId: 'idc-r-1',
  resourceName: null,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'Oracle',
  region: null,
  idcKind: 'IP',
  connectTargets: [],
  port: 1521,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: 'IDC',
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...over,
});

const addresses = (pairs: ReturnType<typeof findDuplicateAddressPairs>): string[][] =>
  pairs.map((p) => [p.a.address, p.b.address]);

describe('findDuplicateAddressPairs', () => {
  it('IP Set 의 주소 옆 번지를 단독으로 올린 행을 잡는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.14'] }),
    ]);
    expect(addresses(pairs)).toEqual([['10.20.1.13', '10.20.1.14']]);
    expect(pairs[0].a.addressCount).toBe(3);
    expect(pairs[0].b.addressCount).toBe(1);
  });

  it('주소가 하나씩인 행끼리도 잡는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.32'] }),
    ]);
    expect(addresses(pairs)).toEqual([['10.20.2.31', '10.20.2.32']]);
  });

  it('주소가 완전히 같으면 잡는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.31'] }),
    ]);
    expect(addresses(pairs)).toEqual([['10.20.2.31', '10.20.2.31']]);
  });

  it('Database Type 이 다르면 조용하다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', databaseType: 'Oracle', connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', databaseType: 'MySQL', connectTargets: ['10.20.2.33'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('Port 가 다르면 조용하다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', port: 1521, connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', port: 1522, connectTargets: ['10.20.2.33'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('Database Type 의 대소문자만 다른 건 같은 엔진으로 본다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', databaseType: 'Oracle', connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', databaseType: 'ORACLE', connectTargets: ['10.20.2.33'] }),
    ]);
    expect(pairs).toHaveLength(1);
  });

  it('대역이 다르면 마지막 자리가 붙어 있어도 조용하다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.32'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('한 행 안의 IP Set 은 서로 비교하지 않는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('제외된 행은 비교하지 않는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', selected: false, connectTargets: ['10.20.1.12'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('도메인 행은 비교 대상이 아니다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', idcKind: 'HOST', connectTargets: ['db.order.prod.internal'] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('접속 주소가 없는 클라우드 행끼리는 아무것도 만들지 않는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', idcKind: null, resourceType: 'RDS', connectTargets: [] }),
      row({ resourceId: 'b', idcKind: null, resourceType: 'RDS', connectTargets: [] }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('한 행 쌍은 여러 주소가 인접해도 한 건으로 보고한다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12', '10.20.1.13'] }),
    ]);
    expect(pairs).toHaveLength(1);
  });

  it('Port 가 없는 행은 판단 근거가 없으므로 비교하지 않는다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', port: null, connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', port: null, connectTargets: ['10.20.1.12'] }),
    ]);
    expect(pairs).toEqual([]);
  });
});
