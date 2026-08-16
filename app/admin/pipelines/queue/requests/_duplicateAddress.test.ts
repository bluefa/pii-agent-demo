import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import {
  findDuplicateAddressPairs,
  suspectMarksByRow,
  suspectRowsInPairOrder,
} from '@/app/admin/pipelines/queue/requests/_duplicateAddress';

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

  it('쌍마다 A·B… 이름을 붙인다', () => {
    const pairs = findDuplicateAddressPairs([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.5.41'] }),
      row({ resourceId: 'd', connectTargets: ['10.20.5.42'] }),
    ]);
    expect(pairs.map((p) => p.label)).toEqual(['A', 'B']);
  });
});

describe('suspectMarksByRow', () => {
  it('두 쌍에 걸친 행은 이름을 둘 다 가진다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.1.13'] }),
    ];
    const marks = suspectMarksByRow(findDuplicateAddressPairs(rows));
    expect(marks.get(rows[0])?.labels).toEqual(['A']);
    expect(marks.get(rows[1])?.labels).toEqual(['A', 'B']);
    expect(marks.get(rows[2])?.labels).toEqual(['B']);
  });

  it('걸린 주소만 짚는다 — IP Set 의 나머지는 아니다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.14'] }),
    ];
    const marks = suspectMarksByRow(findDuplicateAddressPairs(rows));
    expect(marks.get(rows[0])?.addresses).toEqual(['10.20.1.13']);
    expect(marks.get(rows[1])?.addresses).toEqual(['10.20.1.14']);
  });

  it('의심되지 않는 행은 키가 없다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.9.99'] }),
    ];
    const marks = suspectMarksByRow(findDuplicateAddressPairs(rows));
    expect(marks.has(rows[2])).toBe(false);
  });
});

describe('suspectRowsInPairOrder', () => {
  it('쌍끼리 붙여 세우고, 두 쌍에 걸친 행은 한 번만 넣는다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.1.13'] }),
    ];
    const ordered = suspectRowsInPairOrder(findDuplicateAddressPairs(rows));
    expect(ordered).toEqual([rows[0], rows[1], rows[2]]);
  });

  it('멀리 떨어진 짝을 서로 옆으로 데려온다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'x', databaseType: 'MySQL', port: 3306, connectTargets: ['10.20.7.70'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
    ];
    const ordered = suspectRowsInPairOrder(findDuplicateAddressPairs(rows));
    expect(ordered).toEqual([rows[0], rows[2]]);
  });
});
