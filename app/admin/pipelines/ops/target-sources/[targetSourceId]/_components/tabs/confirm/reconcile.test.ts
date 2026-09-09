import { describe, expect, it } from 'vitest';
import {
  reconcileKey,
  reconcileResources,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/reconcile';

interface Approved {
  resourceId: string | null;
  selected: boolean;
  connectTargets?: readonly string[];
  port?: number | null;
}

interface Confirmed {
  resourceId: string | null;
  connectTargets?: readonly string[];
  port?: number | null;
}

const approved = (resourceId: string, selected = true): Approved => ({ resourceId, selected });
const confirmed = (resourceId: string): Confirmed => ({ resourceId });

describe('reconcileResources', () => {
  it('두 쪽이 같으면 전부 일치이고 차이는 0이다', () => {
    const result = reconcileResources(
      [approved('a'), approved('b')],
      [confirmed('b'), confirmed('a')],
    );

    expect(result.rows.map((row) => row.verdict)).toEqual(['match', 'match']);
    expect(result.diffCount).toBe(0);
    expect(result.missingConfirmed).toBe(0);
    expect(result.missingApproved).toBe(0);
  });

  it('승인에만 있는 행은 확정 없음이다', () => {
    const result = reconcileResources([approved('a'), approved('b')], [confirmed('a')]);

    expect(result.rows.map((row) => row.verdict)).toEqual(['match', 'missingConfirmed']);
    expect(result.missingConfirmed).toBe(1);
    expect(result.rows[1].confirmed).toBeNull();
    expect(result.diffCount).toBe(1);
  });

  it('확정에만 있는 행은 승인 없음이고, 승인 행 뒤에 붙는다', () => {
    const result = reconcileResources([approved('a')], [confirmed('a'), confirmed('z')]);

    expect(result.rows.map((row) => row.verdict)).toEqual(['match', 'missingApproved']);
    expect(result.rows[1].approved).toBeNull();
    expect(result.rows[1].confirmed).toEqual(confirmed('z'));
    expect(result.missingApproved).toBe(1);
  });

  it('두 쪽이 서로 다르면 양쪽 차이를 함께 센다', () => {
    const result = reconcileResources(
      [approved('a'), approved('b')],
      [confirmed('b'), confirmed('z')],
    );

    expect(result.rows.map((row) => row.verdict)).toEqual([
      'missingConfirmed',
      'match',
      'missingApproved',
    ]);
    expect(result.missingConfirmed).toBe(1);
    expect(result.missingApproved).toBe(1);
    expect(result.diffCount).toBe(2);
  });

  it('확정이 비어 있으면 승인 행 전부가 확정 없음으로 남는다 — 표는 그래도 그 행들을 싣는다', () => {
    const result = reconcileResources([approved('a'), approved('b')], []);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.verdict === 'missingConfirmed')).toBe(true);
    expect(result.diffCount).toBe(2);
  });

  it('선택되지 않은 승인 행은 대조에 들어가지 않는다 — 확정될 예정이 아니었다', () => {
    const result = reconcileResources([approved('a'), approved('b', false)], [confirmed('a')]);

    expect(result.rows).toHaveLength(1);
    expect(result.diffCount).toBe(0);
  });

  it('resource id 가 없는 IDC 행은 접속 주소 + Port 로 맞춘다', () => {
    // 같은 엔드포인트인데 호스트 순서만 다르다 — 한 쪽 payload 의 나열 순서일 뿐이다.
    const result = reconcileResources(
      [{ resourceId: null, selected: true, connectTargets: ['10.0.0.2', '10.0.0.1'], port: 3306 }],
      [{ resourceId: null, connectTargets: ['10.0.0.1', '10.0.0.2'], port: 3306 }],
    );

    expect(result.rows.map((row) => row.verdict)).toEqual(['match']);
    expect(result.diffCount).toBe(0);
  });

  it('주소가 같아도 Port 가 다르면 다른 리소스다', () => {
    const result = reconcileResources(
      [{ resourceId: null, selected: true, connectTargets: ['db.internal'], port: 3306 }],
      [{ resourceId: null, connectTargets: ['db.internal'], port: 1521 }],
    );

    expect(result.rows.map((row) => row.verdict)).toEqual(['missingConfirmed', 'missingApproved']);
    expect(result.diffCount).toBe(2);
  });

  it('같은 키가 두 번 와도 행을 잃지 않는다', () => {
    const result = reconcileResources(
      [{ resourceId: null, selected: true, connectTargets: ['db.internal'], port: 3306 }],
      [
        { resourceId: null, connectTargets: ['db.internal'], port: 3306 },
        { resourceId: null, connectTargets: ['db.internal'], port: 3306 },
      ],
    );

    expect(result.rows.map((row) => row.verdict)).toEqual(['match', 'missingApproved']);
  });
});

describe('reconcileKey', () => {
  it('resource id 가 있으면 그것이 키다', () => {
    expect(reconcileKey({ resourceId: 'arn:1', connectTargets: ['h'], port: 3306 })).toBe('id:arn:1');
  });

  it('빈 문자열은 id 가 아니다 — 주소로 내려간다', () => {
    expect(reconcileKey({ resourceId: '', connectTargets: ['h'], port: 3306 })).toBe('addr:h:3306');
  });
});
