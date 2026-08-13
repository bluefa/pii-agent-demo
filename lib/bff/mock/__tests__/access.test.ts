/**
 * 서비스 접근 권한 mock 의 규칙들 (docs/api/access-assumed-contracts.md).
 *
 * 계약은 오너가 준 백엔드 초안 스펙 그대로이고, 그 동작 정의가 사는 곳은 이 mock 하나다.
 * 여기서 검증하는 것:
 *  - 승인이 곧 부여다 (별도 부여 호출 없음) + 이력이 남는다
 *  - 이미 처리된 요청은 **400** (스펙이 400 이라고 적었다 — 409 가 아니다)
 *  - 반려 사유는 필수 (400)
 *  - 직접 부여와 요청 승인은 목록의 열이 아니라 이력의 type 으로 갈린다
 *  - service_code 필터가 그 서비스의 이력만 돌려준다
 *  - 요청 생성은 멱등이다 (PENDING 이 있으면 유지, 에러가 아니다)
 *  - access_status 가 OWNED / REQUESTED / REJECTED / NONE 으로 갈린다
 *  - 마지막 관리자는 회수할 수 없다
 *  - email 은 대소문자를 무시하는 식별 키다
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { NextResponse } from 'next/server';

import { __resetAccessStore, mockAccess } from '@/lib/bff/mock/access';
import * as mockData from '@/lib/mock-data';
import type {
  AccessHistoryPageWire,
  AdminListWire,
  PermissionRequestDetailPageWire,
  PermissionRequestDetailWire,
  PermissionRequestPageWire,
  ServiceOwnersWire,
  UserServicePageWire,
} from '@/lib/bff/types';

const body = async <T>(res: NextResponse): Promise<T> => (await res.json()) as T;

/** 쓰기의 식별 키는 email — 테스트도 계약과 같은 키로 부른다. */
const CHOI = 'choi@company.com';
const ADMIN = 'admin@company.com';
const KIM = 'kim@company.com';

/** 승인 대기 시드 — user-6(choi) 의 aws 요청. */
const PENDING_REQUEST_ID = 1001;

const owners = async (serviceCode: string): Promise<ServiceOwnersWire> =>
  body<ServiceOwnersWire>(await mockAccess.listServiceOwners(serviceCode));

beforeEach(() => {
  __resetAccessStore();
  mockData.setCurrentUser('admin-1');
});

describe('승인', () => {
  it('승인이 곧 부여다 — 권한 사용자 목록에 나타난다', async () => {
    await mockAccess.approveRequest(PENDING_REQUEST_ID, '확인했어요');

    const granted = (await owners('aws')).owners.find((row) => row.email === CHOI);
    expect(granted).toBeDefined();
    // 계약이 주는 건 사람 그 자체다 — 이름도, 부여 메타데이터도 없다.
    expect(granted?.knox_id).toBe('donghyun.choi');
    expect(granted).not.toHaveProperty('granted_at');
    expect(granted).not.toHaveProperty('grant_type');
  });

  it('승인 메시지와 판정이 상세에 남는다', async () => {
    await mockAccess.approveRequest(PENDING_REQUEST_ID, '확인했어요');
    const detail = await body<PermissionRequestDetailWire>(
      await mockAccess.getRequest(PENDING_REQUEST_ID),
    );
    expect(detail.status).toBe('APPROVED');
    expect(detail.processed_note).toBe('확인했어요');
    expect(detail.processed_by?.email).toBe(ADMIN);
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
    expect(entry?.actor_user.email).toBe(ADMIN);
  });

  it('이미 처리된 요청은 400 이다 (스펙)', async () => {
    await mockAccess.approveRequest(PENDING_REQUEST_ID, '');
    expect((await mockAccess.approveRequest(PENDING_REQUEST_ID, '')).status).toBe(400);
    expect((await mockAccess.rejectRequest(PENDING_REQUEST_ID, '늦었어요')).status).toBe(400);
  });
});

describe('반려', () => {
  it('사유가 비면 400 이고 요청은 그대로 대기 상태다', async () => {
    expect((await mockAccess.rejectRequest(PENDING_REQUEST_ID, '   ')).status).toBe(400);

    const pending = await body<PermissionRequestPageWire>(
      await mockAccess.listRequests('PENDING', 0, 50),
    );
    expect(pending.content.some((row) => row.request_id === PENDING_REQUEST_ID)).toBe(true);
  });

  it('반려해도 권한은 부여되지 않는다', async () => {
    await mockAccess.rejectRequest(PENDING_REQUEST_ID, '담당 조직이 달라요');
    expect((await owners('aws')).owners.some((row) => row.email === CHOI)).toBe(false);
  });
});

describe('목록의 행', () => {
  it('사유와 상태를 싣지 않는다 — 계약 갭 B3', async () => {
    const pending = await body<PermissionRequestPageWire>(
      await mockAccess.listRequests('PENDING', 0, 50),
    );
    const row = pending.content[0];
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('reason');
    expect(row).not.toHaveProperty('status');
  });

  it('status 를 생략하면 PENDING 이 기본이다 (스펙)', async () => {
    const fallback = await body<PermissionRequestPageWire>(
      await mockAccess.listRequests(undefined, 0, 50),
    );
    const pending = await body<PermissionRequestPageWire>(
      await mockAccess.listRequests('PENDING', 0, 50),
    );
    expect(fallback.totalElements).toBe(pending.totalElements);
  });
});

describe('직접 부여 · 해제', () => {
  it('부여·해제는 갱신된 전체 목록을 돌려준다', async () => {
    const added = await body<ServiceOwnersWire>(await mockAccess.addServiceOwners('gcp', [CHOI]));
    expect(added.owners.some((row) => row.email === CHOI)).toBe(true);

    const removed = await body<ServiceOwnersWire>(
      await mockAccess.removeServiceOwner('gcp', CHOI),
    );
    expect(removed.owners.some((row) => row.email === CHOI)).toBe(false);
  });

  it('부여 경로는 목록이 아니라 이력의 type 으로 갈린다', async () => {
    await mockAccess.addServiceOwners('gcp', [CHOI]);
    const history = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'gcp' }, 0, 50),
    );
    expect(history.content[0]?.type).toBe('GRANTED');
  });

  it('service_code 필터는 그 서비스의 이력만 돌려준다', async () => {
    await mockAccess.addServiceOwners('gcp', [CHOI]);

    const scoped = await body<AccessHistoryPageWire>(
      await mockAccess.listHistory({ serviceCode: 'gcp' }, 0, 100),
    );
    expect(scoped.content.length).toBeGreaterThan(0);
    expect(scoped.content.every((row) => row.service_code === 'gcp')).toBe(true);

    const all = await body<AccessHistoryPageWire>(await mockAccess.listHistory({}, 0, 100));
    expect(all.totalElements).toBeGreaterThan(scoped.totalElements);
  });

  it('서비스 목록의 권한자 수가 부여를 따라간다', async () => {
    const before = await body<{ content: { service_code: string; owner_count: number }[] }>(
      await mockAccess.listServices(undefined, 0, 100),
    );
    const gcpBefore = before.content.find((row) => row.service_code === 'gcp')?.owner_count ?? 0;

    await mockAccess.addServiceOwners('gcp', [CHOI]);

    const after = await body<{ content: { service_code: string; owner_count: number }[] }>(
      await mockAccess.listServices(undefined, 0, 100),
    );
    expect(after.content.find((row) => row.service_code === 'gcp')?.owner_count).toBe(
      gcpBefore + 1,
    );
  });
});

describe('요청자 측', () => {
  it('access_status 가 보유·대기·없음으로 갈린다', async () => {
    mockData.setCurrentUser('user-6');
    const services = await body<UserServicePageWire>(
      await mockAccess.listUserServices(undefined, 0, 100),
    );
    const statusOf = (code: string): string | undefined =>
      services.content.find((row) => row.service_code === code)?.access_status;

    expect(statusOf('aws')).toBe('REQUESTED'); // 시드 1001 이 대기 중
    expect(statusOf('gcp')).toBe('NONE');
  });

  it('서비스 검색은 코드·이름 어느 쪽이든, 대소문자 없이 걸린다', async () => {
    mockData.setCurrentUser('user-6');
    const codes = async (query: string): Promise<string[]> =>
      (
        await body<UserServicePageWire>(await mockAccess.listUserServices(query, 0, 100))
      ).content.map((row) => row.service_code);

    // 코드는 소문자 'azure', 이름은 대문자 'Azure' — 어느 쪽으로 쳐도 같은 한 건.
    expect(await codes('AZ')).toEqual(['azure']);
    expect(await codes('azure')).toEqual(['azure']);
    expect(await codes('없는서비스')).toEqual([]);
  });

  it('반려된 서비스는 REJECTED 로 남는다', async () => {
    mockData.setCurrentUser('user-7'); // 시드 1004 가 반려된 사용자
    const services = await body<UserServicePageWire>(
      await mockAccess.listUserServices(undefined, 0, 100),
    );
    expect(services.content.find((row) => row.service_code === 'idc')?.access_status).toBe(
      'REJECTED',
    );
  });

  it('요청 생성은 멱등이다 — 두 번 불러도 에러가 아니고 한 건만 남는다', async () => {
    mockData.setCurrentUser('user-6');
    expect((await mockAccess.createRequest('gcp', '첫 요청')).status).toBe(200);
    expect((await mockAccess.createRequest('gcp', '두 번째 요청')).status).toBe(200);

    const mine = await body<PermissionRequestDetailPageWire>(
      await mockAccess.listMyRequests(0, 50),
    );
    expect(mine.content.filter((row) => row.service_code === 'gcp')).toHaveLength(1);
    expect(mine.content.find((row) => row.service_code === 'gcp')?.reason).toBe('첫 요청');
  });

  it('요청하면 그 서비스의 access_status 가 REQUESTED 로 바뀐다', async () => {
    mockData.setCurrentUser('user-6');
    await mockAccess.createRequest('gcp', '점검 업무가 배정됐어요');
    const services = await body<UserServicePageWire>(
      await mockAccess.listUserServices(undefined, 0, 100),
    );
    expect(services.content.find((row) => row.service_code === 'gcp')?.access_status).toBe(
      'REQUESTED',
    );
  });

  it('내 요청 내역은 내 것만, 반려 사유까지 담는다', async () => {
    mockData.setCurrentUser('user-7');
    const mine = await body<PermissionRequestDetailPageWire>(
      await mockAccess.listMyRequests(0, 50),
    );
    expect(mine.content.length).toBeGreaterThan(0);
    expect(mine.content.every((row) => row.requester.email === 'kang@company.com')).toBe(true);
    expect(mine.content.find((row) => row.status === 'REJECTED')?.processed_note).toContain(
      '담당 조직',
    );
  });

  it('관리자가 아니면 관리자용 목록을 볼 수 없다', async () => {
    mockData.setCurrentUser('user-6');
    expect((await mockAccess.listRequests('PENDING', 0, 10)).status).toBe(403);
    expect((await mockAccess.listServiceOwners('aws')).status).toBe(403);
    expect((await mockAccess.listServices(undefined, 0, 10)).status).toBe(403);
  });
});

describe('관리자 권한', () => {
  it('마지막 관리자는 회수할 수 없다 (스펙)', async () => {
    expect((await mockAccess.removeAdmin(ADMIN)).status).toBe(400);
  });

  it('둘 이상이면 자기 자신도 회수할 수 있다', async () => {
    await mockAccess.addAdmin(KIM);
    expect((await mockAccess.removeAdmin(ADMIN)).status).toBe(200);

    // 스스로 관리자에서 내려왔으므로 이제 관리자 목록을 볼 수 없다 — 규칙이 일관되다는
    // 증거다(화면은 이 시점에 admin 게이트에 걸려 되돌아간다).
    expect((await mockAccess.listAdmins()).status).toBe(403);

    mockData.setCurrentUser('user-2'); // KIM — 남은 관리자
    const list = await body<AdminListWire>(await mockAccess.listAdmins());
    expect(list.admins.some((row) => row.email === ADMIN)).toBe(false);
    expect(list.admins.some((row) => row.email === KIM)).toBe(true);
  });

  it('부여하면 목록에 들어오고 회수하면 빠진다', async () => {
    await mockAccess.addAdmin(CHOI);
    const added = await body<AdminListWire>(await mockAccess.listAdmins());
    expect(added.admins.some((row) => row.email === CHOI)).toBe(true);

    await mockAccess.removeAdmin(CHOI);
    const removed = await body<AdminListWire>(await mockAccess.listAdmins());
    expect(removed.admins.some((row) => row.email === CHOI)).toBe(false);
  });

  it('email 대소문자가 달라도 같은 사람이다', async () => {
    await mockAccess.addAdmin(CHOI.toUpperCase());
    const list = await body<AdminListWire>(await mockAccess.listAdmins());
    expect(list.admins.filter((row) => row.email === CHOI)).toHaveLength(1);
  });
});

describe('사용자 검색', () => {
  // 질의 없이 부르면 사람 디렉터리 전체를 열거하는 창구가 된다.
  it('빈 질의는 아무도 돌려주지 않는다', async () => {
    for (const blank of [undefined, '', '   ']) {
      const found = await body<{ users: unknown[] }>(await mockAccess.searchUsers(blank, []));
      expect(found.users).toHaveLength(0);
    }
  });

  it('excludeEmails 로 이미 가진 사람을 걸러 낸다', async () => {
    const held = (await owners('aws')).owners.map((row) => row.email);
    const found = await body<{ users: { email: string }[] }>(
      await mockAccess.searchUsers('company.com', held),
    );
    expect(found.users.length).toBeGreaterThan(0);
    expect(found.users.some((row) => held.includes(row.email))).toBe(false);
  });

  it('knox_id 로도 찾힌다 (이름은 계약에 없다)', async () => {
    const found = await body<{ users: { knox_id: string }[] }>(
      await mockAccess.searchUsers('donghyun', []),
    );
    expect(found.users.map((row) => row.knox_id)).toContain('donghyun.choi');
  });
});
