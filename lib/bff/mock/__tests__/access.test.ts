/**
 * 접근 권한 mock 의 규칙들 (docs/api/access-assumed-contracts.md).
 *
 * 계약이 전부 assumed 라서 규칙이 사는 곳은 이 mock 하나뿐이다. 여기서 검증하는 것:
 *  - 승인이 곧 부여다 (별도 부여 호출 없음) + 이력이 남는다
 *  - 이미 처리된 요청은 다시 결정할 수 없다 (409)
 *  - 반려 사유는 필수 (400)
 *  - 직접 부여는 이력에 요청 승인과 다른 종류로 남는다
 *  - service_code 필터가 그 서비스의 이력만 돌려준다
 *  - 요청 가능한 서비스에서 보유·대기 중인 것이 빠진다
 *  - 자기 자신의 관리자 권한은 회수할 수 없다
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { NextResponse } from 'next/server';

import { __resetAccessStore, mockAccess } from '@/lib/bff/mock/access';
import * as mockData from '@/lib/mock-data';
import type {
  AccessGrantPageWire,
  AccessHistoryPageWire,
  AccessRequestItemWire,
  AccessRequestPageWire,
  RequestableServicePageWire,
} from '@/lib/bff/types';

/** 쓰기의 식별 키는 email — 테스트도 계약과 같은 키로 부른다. */
const CHOI = 'choi@company.com';
const ADMIN = 'admin@company.com';

const body = async <T>(res: NextResponse): Promise<T> => (await res.json()) as T;

/** 승인 대기 시드 — user-6 의 aws 요청. */
const PENDING_REQUEST_ID = 1001;

beforeEach(() => {
  __resetAccessStore();
  mockData.setCurrentUser('admin-1');
});

describe('승인', () => {
  it('승인이 곧 부여다 — 권한 목록에 요청 승인 경로로 나타난다', async () => {
    const approved = await body<AccessRequestItemWire>(
      await mockAccess.approveRequest(PENDING_REQUEST_ID, '확인했어요'),
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.verdict_message).toBe('확인했어요');

    const users = await body<AccessGrantPageWire>(await mockAccess.listServiceUsers('aws', 0, 50));
    const granted = users.content.find((row) => row.email === CHOI);
    expect(granted).toBeDefined();
    // 계약이 주는 건 사람 그 자체다 — 이름도, 부여 메타데이터도 없다.
    expect(granted?.knox_id).toBe('donghyun.choi');
    expect(granted).not.toHaveProperty('granted_at');
    expect(granted).not.toHaveProperty('grant_type');
  });

  it('승인 이력이 그 서비스 코드로 남는다', async () => {
    await mockAccess.approveRequest(PENDING_REQUEST_ID, '');

    const history = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'aws' }, 0, 50),
    );
    const entry = history.content.find(
      (row) => row.type === 'APPROVED' && row.target_user.email === CHOI,
    );
    expect(entry).toBeDefined();
    expect(entry?.actor.email).toBe(ADMIN);
  });

  it('이미 처리된 요청은 다시 결정할 수 없다', async () => {
    await mockAccess.approveRequest(PENDING_REQUEST_ID, '');
    const second = await mockAccess.approveRequest(PENDING_REQUEST_ID, '');
    expect(second.status).toBe(409);

    const rejectAfter = await mockAccess.rejectRequest(PENDING_REQUEST_ID, '늦었어요');
    expect(rejectAfter.status).toBe(409);
  });
});

describe('반려', () => {
  it('사유가 비면 400 이고 요청은 그대로 대기 상태다', async () => {
    const res = await mockAccess.rejectRequest(PENDING_REQUEST_ID, '   ');
    expect(res.status).toBe(400);

    const pending = await body<AccessRequestPageWire>(
      await mockAccess.listRequests('PENDING', 0, 50),
    );
    expect(pending.content.some((row) => row.request_id === PENDING_REQUEST_ID)).toBe(true);
  });

  it('반려해도 권한은 부여되지 않는다', async () => {
    await mockAccess.rejectRequest(PENDING_REQUEST_ID, '담당 조직이 달라요');

    const users = await body<AccessGrantPageWire>(await mockAccess.listServiceUsers('aws', 0, 50));
    expect(users.content.some((row) => row.email === CHOI)).toBe(false);
  });
});

describe('직접 부여 · 해제', () => {
  it('직접 부여는 요청 승인과 다른 경로로 기록된다', async () => {
    await mockAccess.grantServiceUsers('gcp', [CHOI]);

    const users = await body<AccessGrantPageWire>(await mockAccess.listServiceUsers('gcp', 0, 50));
    expect(users.content.some((row) => row.email === CHOI)).toBe(true);

    // 부여 경로는 목록의 열이 아니라 이력의 이벤트 종류로만 남는다.
    const history = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'gcp' }, 0, 50),
    );
    expect(history.content[0]?.type).toBe('GRANTED');
  });

  it('해제하면 목록에서 빠지고 이력에 남는다', async () => {
    await mockAccess.grantServiceUsers('gcp', [CHOI]);
    await mockAccess.revokeServiceUser('gcp', CHOI);

    const users = await body<AccessGrantPageWire>(await mockAccess.listServiceUsers('gcp', 0, 50));
    expect(users.content.some((row) => row.email === CHOI)).toBe(false);

    const history = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'gcp' }, 0, 50),
    );
    expect(history.content[0]?.type).toBe('REVOKED');
  });

  it('service_code 필터는 그 서비스의 이력만 돌려준다', async () => {
    await mockAccess.grantServiceUsers('gcp', [CHOI]);

    const scoped = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'gcp' }, 0, 100),
    );
    expect(scoped.content.length).toBeGreaterThan(0);
    expect(scoped.content.every((row) => row.service_code === 'gcp')).toBe(true);

    const global = await body<AccessHistoryPageWire>(await mockAccess.listHistory({}, 0, 100));
    expect(global.totalElements).toBeGreaterThan(scoped.totalElements);
  });
});

describe('요청자 측', () => {
  it('요청 가능한 서비스에서 보유·대기 중인 것이 빠진다', async () => {
    mockData.setCurrentUser('user-6');

    const before = await body<RequestableServicePageWire>(
      await mockAccess.listRequestableServices(undefined, 0, 50),
    );
    expect(before.content.some((row) => row.service_code === 'aws')).toBe(false); // 이미 대기 중(1001)
    expect(before.content.some((row) => row.service_code === 'gcp')).toBe(true);

    await mockAccess.createRequest('gcp', '점검 업무가 배정됐어요');

    const after = await body<RequestableServicePageWire>(
      await mockAccess.listRequestableServices(undefined, 0, 50),
    );
    expect(after.content.some((row) => row.service_code === 'gcp')).toBe(false);
  });

  it('같은 서비스에 두 번 요청할 수 없다', async () => {
    mockData.setCurrentUser('user-6');
    await mockAccess.createRequest('gcp', '첫 요청');
    const second = await mockAccess.createRequest('gcp', '두 번째 요청');
    expect(second.status).toBe(409);
  });

  it('내 요청 내역은 내 것만 담는다', async () => {
    mockData.setCurrentUser('user-6');
    const mine = await body<AccessRequestPageWire>(await mockAccess.listMyRequests(0, 50));
    expect(mine.content.length).toBeGreaterThan(0);
    expect(mine.content.every((row) => row.requester.email === CHOI)).toBe(true);
  });

  it('관리자가 아니면 관리자용 목록을 볼 수 없다', async () => {
    mockData.setCurrentUser('user-6');
    expect((await mockAccess.listRequests('PENDING', 0, 10)).status).toBe(403);
    expect((await mockAccess.listServiceUsers('aws', 0, 10)).status).toBe(403);
  });
});

describe('관리자 권한', () => {
  it('자기 자신은 회수할 수 없다', async () => {
    const res = await mockAccess.revokeAdmin(ADMIN);
    expect(res.status).toBe(400);
  });

  it('부여하면 목록에 들어오고 회수하면 빠진다', async () => {
    await mockAccess.grantAdmins([CHOI]);
    const added = await body<AccessGrantPageWire>(await mockAccess.listAdmins(0, 50));
    expect(added.content.some((row) => row.email === CHOI)).toBe(true);

    await mockAccess.revokeAdmin(CHOI);
    const removed = await body<AccessGrantPageWire>(await mockAccess.listAdmins(0, 50));
    expect(removed.content.some((row) => row.email === CHOI)).toBe(false);
  });

  it('email 대소문자가 달라도 같은 사람이다', async () => {
    await mockAccess.grantAdmins([CHOI.toUpperCase()]);
    const added = await body<AccessGrantPageWire>(await mockAccess.listAdmins(0, 50));
    expect(added.content.filter((row) => row.email === CHOI)).toHaveLength(1);
  });
});
