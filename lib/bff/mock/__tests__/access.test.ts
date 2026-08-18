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
  MyAccessRequestPageWire,
  PermissionRequestDetailWire,
  PermissionRequestPageWire,
  ServiceOwnersWire,
  ServicePageWire,
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
      (row) => row.type === 'REQUEST_APPROVED' && row.target_user.email === CHOI,
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
    expect(history.content[0]?.type).toBe('OWNER_GRANTED');
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

  it('서비스 검색은 담당자로도 걸린다 — 사람이 아니라 그 사람이 담당인 서비스가 나온다', async () => {
    const codes = async (query: string): Promise<string[]> =>
      (
        await body<{ content: { service_code: string }[] }>(
          await mockAccess.listServices(query, 0, 100),
        )
      ).content.map((row) => row.service_code);

    // 화면에 찍히는 Knox ID 로도, 식별 키인 email 로도 같은 결과.
    expect(await codes('haneul.kang')).toEqual(['gcp']);
    expect(await codes('kang@company.com')).toEqual(['gcp']);
    // 담당자가 붙으면 그 서비스가 검색에 새로 들어온다.
    await mockAccess.addServiceOwners('NTF', [CHOI]);
    expect(await codes('donghyun.choi')).toContain('NTF');
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
    const services = await body<ServicePageWire>(
      await mockAccess.listServicesPage(undefined, 0, 100),
    );
    const statusOf = (code: string): string | undefined =>
      services.content.find((row) => row.service_code === code)?.access_status;

    expect(statusOf('aws')).toBe('REQUESTED'); // 시드 1001 이 대기 중
    expect(statusOf('gcp')).toBe('NONE');
  });

  it('담당 서비스 목록은 내가 담당인 것만 준다 — 전체 목록은 다른 호출이다', async () => {
    mockData.setCurrentUser('user-7'); // gcp 한 건만 담당
    const mine = await body<UserServicePageWire>(
      await mockAccess.listUserServices(undefined, 0, 100),
    );
    expect(mine.content.map((row) => row.service_code)).toEqual(['gcp']);

    // 같은 호출자가 전체 목록을 부르면 신청 대상이 다 보인다 — 두 탭의 소스가 갈린
    // 이유가 이것이다(2026-08-14 오너 스펙).
    const all = await body<ServicePageWire>(await mockAccess.listServicesPage(undefined, 0, 100));
    expect(all.content.length).toBe(mockData.mockServiceCodes.length);
  });

  it('ADMIN 은 담당 서비스 목록으로도 전체를 받는다 — 화면이 OWNED 로 다시 거른다', async () => {
    mockData.setCurrentUser('admin-1');
    // 담당 서비스 목록을 여기 베껴 적지 않는다. 그 목록은 화면을 보려고 늘었다 줄었다
    // 하는 값이고(2026-08-17 에 두 건 → 여덟 건), 이 테스트가 붙잡는 건 그 목록이 아니라
    // "ADMIN 에게는 전체가 오고, 담당인 것만 OWNED 로 갈린다"다.
    // 조회 **뒤에** 읽는다. 스토어는 첫 조회 때 늦게 심기고 그때 이 배열을 다시 잡으므로,
    // 먼저 읽어 두면 심기 전 값을 붙잡게 된다 — 지금은 admin-1 을 건드리는 테스트가 없어
    // 같은 값이지만, 하나 생기는 순간 조용히 어긋난다.
    const mine = await body<UserServicePageWire>(
      await mockAccess.listUserServices(undefined, 0, 100),
    );
    const declared = mockData.mockUsers.find((u) => u.id === 'admin-1')?.serviceCodePermissions;
    expect(mine.content.length).toBe(mockData.mockServiceCodes.length);
    expect(
      mine.content
        .filter((row) => row.access_status === 'OWNED')
        .map((r) => r.service_code)
        .sort(),
    ).toEqual([...(declared ?? [])].sort());
  });

  it('전체 목록의 행은 담당자를 싣는다 — 없으면 빈 배열과 0', async () => {
    mockData.setCurrentUser('user-6');
    const all = await body<ServicePageWire>(await mockAccess.listServicesPage(undefined, 0, 100));
    const gcp = all.content.find((row) => row.service_code === 'gcp');

    // 행의 둘째 단이 이 값이다. 계약에 사람 이름이 없어 Knox ID 가 표시명이다.
    expect(gcp?.owners).toContain('haneul.kang');
    expect(gcp?.owner_count).toBe(gcp?.owners.length);
    // 담당자가 없는 서비스도 키는 있어야 한다 — 화면이 "담당자 없음"을 그 수로 판단한다.
    expect(all.content.every((row) => Array.isArray(row.owners))).toBe(true);
  });

  it('서비스 검색은 코드·이름 어느 쪽이든, 대소문자 없이 걸린다', async () => {
    mockData.setCurrentUser('user-6');
    const codes = async (query: string): Promise<string[]> =>
      (
        await body<ServicePageWire>(await mockAccess.listServicesPage(query, 0, 100))
      ).content.map((row) => row.service_code);

    // 코드는 소문자 'azure', 이름은 대문자 'Azure' — 어느 쪽으로 쳐도 같은 한 건.
    expect(await codes('AZ')).toEqual(['azure']);
    expect(await codes('azure')).toEqual(['azure']);
    expect(await codes('없는서비스')).toEqual([]);
  });

  it('반려된 서비스는 REJECTED 로 남는다', async () => {
    mockData.setCurrentUser('user-7'); // 시드 1004 가 반려된 사용자
    const services = await body<ServicePageWire>(
      await mockAccess.listServicesPage(undefined, 0, 100),
    );
    expect(services.content.find((row) => row.service_code === 'idc')?.access_status).toBe(
      'REJECTED',
    );
  });

  it('요청 생성은 멱등이다 — 두 번 불러도 에러가 아니고 한 건만 남는다', async () => {
    mockData.setCurrentUser('user-6');
    expect((await mockAccess.createRequest('gcp', '첫 요청')).status).toBe(200);
    expect((await mockAccess.createRequest('gcp', '두 번째 요청')).status).toBe(200);

    const mine = await body<MyAccessRequestPageWire>(
      await mockAccess.listMyRequests(undefined, 0, 50),
    );
    expect(mine.content.filter((row) => row.service_code === 'gcp')).toHaveLength(1);
    expect(mine.content.find((row) => row.service_code === 'gcp')?.reason).toBe('첫 요청');
  });

  /**
   * 위 두 테스트는 **한 모듈 인스턴스 안에서만** 참이라 런타임의 진짜 실패를 못 잡는다.
   * Next 는 라우트 핸들러를 파일별로 번들링하므로 이 목이 라우트마다 새로 로드된다 —
   * 스토어가 모듈 지역 변수면 POST 라우트가 쓴 요청을 GET 라우트가 영영 못 보고, 화면은
   * 204 를 받고도 목록이 그대로다(실제로 그랬다). 스토어가 globalThis 에 있는지가
   * 그 불변식이고, 여기서만 검사할 수 있다.
   */
  it('쓰기는 globalThis 스토어에 남는다 — 라우트별 모듈 복제를 견딘다', async () => {
    mockData.setCurrentUser('user-6');
    await mockAccess.createRequest('gcp', '모듈이 복제돼도 남아야 한다');

    const shared = globalThis.__accessMockStore;
    expect(shared?.requests.some((r) => r.serviceCode === 'gcp' && r.userId === 'user-6')).toBe(
      true,
    );
  });

  it('요청하면 그 서비스의 access_status 가 REQUESTED 로 바뀐다', async () => {
    mockData.setCurrentUser('user-6');
    await mockAccess.createRequest('gcp', '점검 업무가 배정됐어요');
    const services = await body<ServicePageWire>(
      await mockAccess.listServicesPage(undefined, 0, 100),
    );
    expect(services.content.find((row) => row.service_code === 'gcp')?.access_status).toBe(
      'REQUESTED',
    );
  });

  /**
   * 실구현이 싣는 건 여섯 필드뿐이다 — 요청자도, 처리 결과 셋도 오지 않는다. 목이
   * 관리자 상세의 shape 을 흉내 내는 동안 화면은 `requester.knox_id` 를 읽었고,
   * 실서버에서 그 줄이 터졌다. 목이 좁은 채로 남아 있는지를 여기서 지킨다.
   */
  it('내 요청 내역은 내 것만, 계약이 싣는 여섯 필드만 준다', async () => {
    mockData.setCurrentUser('user-7');
    const mine = await body<MyAccessRequestPageWire>(
      await mockAccess.listMyRequests(undefined, 0, 50),
    );
    expect(mine.content.length).toBeGreaterThan(0);
    expect(Object.keys(mine.content[0] ?? {}).sort()).toEqual([
      'reason',
      'request_id',
      'requested_at',
      'service_code',
      'service_name',
      'status',
    ]);
  });

  it('status 를 주면 그 상태만 온다 — 헤더 건수가 이걸로 센다', async () => {
    // 요청이 한 상태로만 있는 사용자로 재면 필터를 지워도 통과한다. 세 상태가 다 있는
    // admin-1 로 재고, 각각의 `totalElements` 를 **정확한 수**로 못박는다 — 화면 머리가
    // 읽는 건 목록이 아니라 이 값이다(`size: 1` 로 한 줄만 받고 수만 읽는다).
    mockData.setCurrentUser('admin-1');
    const counts: Record<string, number> = {};
    for (const status of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
      const page = await body<MyAccessRequestPageWire>(
        await mockAccess.listMyRequests(status, 0, 1),
      );
      expect(page.content.every((row) => row.status === status)).toBe(true);
      expect(page.content.length).toBeLessThanOrEqual(1);
      counts[status] = page.totalElements;
    }
    expect(counts).toEqual({ PENDING: 3, APPROVED: 2, REJECTED: 2 });

    // 필터를 안 주면 셋의 합이 온다 — 화면의 탭 배지와 머리 세 수가 여기서 맞물린다.
    const all = await body<MyAccessRequestPageWire>(await mockAccess.listMyRequests(undefined, 0, 1));
    expect(all.totalElements).toBe(7);
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
      const found = await body<{ users: unknown[] }>(await mockAccess.searchUsers(blank));
      expect(found.users).toHaveLength(0);
    }
  });

  // 제외는 계약이 아니라 화면 몫이다(`excludeIds` 키잉 미확정 — E4). 목이 몰래 걸러 내면
  // 어댑터의 제외가 빠져도 테스트가 통과해 버린다. 여기선 **거르지 않는 것**이 계약이다.
  it('이미 가진 사람도 그대로 돌려준다 — 제외는 서버가 하지 않는다', async () => {
    const held = (await owners('aws')).owners.map((row) => row.email);
    const found = await body<{ users: { email: string }[] }>(
      await mockAccess.searchUsers('company.com'),
    );
    expect(held.length).toBeGreaterThan(0);
    expect(found.users.some((row) => held.includes(row.email))).toBe(true);
  });

  it('knox_id 로도 찾힌다 (이름은 계약에 없다)', async () => {
    const found = await body<{ users: { knox_id: string }[] }>(
      await mockAccess.searchUsers('donghyun'),
    );
    expect(found.users.map((row) => row.knox_id)).toContain('donghyun.choi');
  });
});
