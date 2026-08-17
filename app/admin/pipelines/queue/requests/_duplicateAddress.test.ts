import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import {
  findSuspectGroups,
  groupSuspectRows,
  suspectMarksByRow,
  suspectRows,
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

/** 그룹을 [주소, 주소 …] 로 납작하게 — 기대값을 눈으로 읽기 위한 것. */
const addressesOf = (groups: ReturnType<typeof findSuspectGroups>): string[][] =>
  groups.map((group) => group.members.flatMap((member) => member.addresses));

describe('findSuspectGroups', () => {
  it('IP Set 의 주소 옆 번지를 단독으로 올린 행을 잡는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.14'] }),
    ]);
    expect(addressesOf(groups)).toEqual([['10.20.1.13', '10.20.1.14']]);
  });

  it('주소가 하나씩인 행끼리도 잡는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.32'] }),
    ]);
    expect(addressesOf(groups)).toEqual([['10.20.2.31', '10.20.2.32']]);
  });

  it('주소가 완전히 같으면 잡는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.31'] }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('연달아 인접한 세 행은 그룹 하나다 — 쌍 둘이 아니다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.12.123.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.12.123.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.12.123.13'] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].label).toBe('1');
  });

  it('그룹 번호는 목록 순서를 따라간다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.5.41'] }),
      row({ resourceId: 'd', connectTargets: ['10.20.5.42'] }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(['1', '2']);
  });

  it('Database Type 이 다르면 조용하다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', databaseType: 'Oracle', connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', databaseType: 'MySQL', connectTargets: ['10.20.2.33'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('Port 가 다르면 조용하다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', port: 1521, connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', port: 1522, connectTargets: ['10.20.2.33'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('Database Type 의 대소문자만 다른 건 같은 엔진으로 본다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', databaseType: 'Oracle', connectTargets: ['10.20.2.32'] }),
      row({ resourceId: 'b', databaseType: 'ORACLE', connectTargets: ['10.20.2.33'] }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('대역이 다르면 마지막 자리가 붙어 있어도 조용하다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.1.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.32'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('한 행 안의 IP Set 은 서로 비교하지 않는다', () => {
    const groups = findSuspectGroups([
      row({ connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('제외된 행은 비교하지 않는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', selected: false, connectTargets: ['10.20.1.12'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('도메인 행은 비교 대상이 아니다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', idcKind: 'HOST', connectTargets: ['db.order.prod.internal'] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('접속 주소가 없는 클라우드 행끼리는 아무것도 만들지 않는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', idcKind: null, resourceType: 'RDS', connectTargets: [] }),
      row({ resourceId: 'b', idcKind: null, resourceType: 'RDS', connectTargets: [] }),
    ]);
    expect(groups).toEqual([]);
  });

  it('Port 가 없는 행은 판단 근거가 없으므로 비교하지 않는다', () => {
    const groups = findSuspectGroups([
      row({ resourceId: 'a', port: null, connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', port: null, connectTargets: ['10.20.1.12'] }),
    ]);
    expect(groups).toEqual([]);
  });
});

describe('suspectMarksByRow', () => {
  it('걸린 주소만 짚는다 — IP Set 의 나머지는 아니다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.14'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[0])?.addresses).toEqual(['10.20.1.13']);
    expect(marks.get(rows[1])?.addresses).toEqual(['10.20.1.14']);
  });

  it('연쇄의 가운데 행도 이름은 하나다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.12.123.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.12.123.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.12.123.13'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[1])?.label).toBe('1');
    expect(marks.get(rows[1])?.addresses).toEqual(['10.12.123.12']);
  });

  it('의심되지 않는 행은 키가 없다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.9.99'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.has(rows[2])).toBe(false);
  });

  it('짝의 주소를 들고 있다 — 자기 주소는 빼고', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.32'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[0])?.partners).toEqual(['10.20.2.32']);
    expect(marks.get(rows[1])?.partners).toEqual(['10.20.2.31']);
  });

  it('연쇄에서는 직접 인접하지 않은 구성원도 짝으로 적는다 — 질문이 그 단위다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.12.123.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.12.123.12'] }),
      row({ resourceId: 'c', connectTargets: ['10.12.123.13'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[0])?.partners).toEqual(['10.12.123.12', '10.12.123.13']);
    expect(marks.get(rows[1])?.partners).toEqual(['10.12.123.11', '10.12.123.13']);
  });

  it('IP Set 은 걸린 주소만 짝으로 넘긴다 — 나머지 주소는 아니다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11', '10.20.1.12', '10.20.1.13'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.14'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[1])?.partners).toEqual(['10.20.1.13']);
  });

  it('완전히 같은 주소를 두 번 등록하면 짝을 한 번만 적는다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.2.31'] }),
      row({ resourceId: 'c', connectTargets: ['10.20.2.31'] }),
    ];
    const marks = suspectMarksByRow(findSuspectGroups(rows));
    expect(marks.get(rows[0])?.partners).toEqual(['10.20.2.31']);
  });
});

describe('groupSuspectRows', () => {
  it('멀리 떨어진 구성원을 첫 구성원 뒤로 데려온다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'x', databaseType: 'MySQL', port: 3306, connectTargets: ['10.20.7.70'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
    ];
    const ordered = groupSuspectRows(rows, findSuspectGroups(rows));
    expect(ordered).toEqual([rows[0], rows[2], rows[1]]);
  });

  it('의심 행이 없으면 순서를 건드리지 않는다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.9.99'] }),
    ];
    expect(groupSuspectRows(rows, findSuspectGroups(rows))).toEqual(rows);
  });

  it('그룹에 없는 행은 제자리에 남는다', () => {
    const rows = [
      row({ resourceId: 'keep', databaseType: 'MySQL', port: 3306, connectTargets: ['10.20.7.70'] }),
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
    ];
    const ordered = groupSuspectRows(rows, findSuspectGroups(rows));
    expect(ordered[0]).toBe(rows[0]);
  });
});

describe('suspectRows', () => {
  it('그룹 순서로 의심 행만 뽑는다', () => {
    const rows = [
      row({ resourceId: 'a', connectTargets: ['10.20.1.11'] }),
      row({ resourceId: 'x', databaseType: 'MySQL', port: 3306, connectTargets: ['10.20.7.70'] }),
      row({ resourceId: 'b', connectTargets: ['10.20.1.12'] }),
    ];
    expect(suspectRows(findSuspectGroups(rows))).toEqual([rows[0], rows[2]]);
  });
});
