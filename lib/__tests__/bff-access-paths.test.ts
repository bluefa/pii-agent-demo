/**
 * 접근 권한 관리 API 의 업스트림 경로 — base 는 `/install/v1/admin/access`.
 *
 * 이 파일이 있는 이유: 관리자 API 는 `docs/swagger/install-v1.yaml` 에 아직 없어서
 * 계약 검사가 잡아 주지 못하고, 목 모드에서는 경로를 아예 타지 않는다(어댑터가
 * 오퍼레이션 단위로 갈린다). 그래서 경로가 틀려도 화면은 멀쩡히 돌아가고, 실 BFF 에
 * 붙는 순간에만 404 로 터진다 — 실제로 `/admin/admins`·`/admin/services` 로 나가다
 * 오너가 발견했다(2026-08-14). 경로를 여기 한 줄씩 박아 둔다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://bff.example.com';

/** 호출 한 번의 URL 을 잡아 온다. 응답 본문은 아무 JSON 이나 되면 된다. */
async function urlOf(call: (bff: typeof import('@/lib/bff/http').httpBff) => Promise<unknown>) {
  process.env.BFF_API_URL = BASE;
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  const { httpBff } = await import('@/lib/bff/http');
  await call(httpBff);
  const [url] = fetchSpy.mock.calls[0] ?? [];
  return String(url).replace(BASE, '');
}

describe('httpBff.access — 업스트림 경로', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  const cases: ReadonlyArray<
    [string, (bff: typeof import('@/lib/bff/http').httpBff) => Promise<unknown>, string]
  > = [
    ['서비스 목록', (b) => b.access.listServices('알림', 0, 5),
      '/install/v1/admin/access/services?q=%EC%95%8C%EB%A6%BC&page=0&size=5'],
    ['권한 사용자 목록', (b) => b.access.listServiceOwners('SVC-A'),
      '/install/v1/admin/access/services/SVC-A/owners'],
    ['직접 부여', (b) => b.access.addServiceOwners('SVC-A', ['a@company.com']),
      '/install/v1/admin/access/services/SVC-A/owners'],
    ['권한 해제', (b) => b.access.removeServiceOwner('SVC-A', 'a@company.com'),
      '/install/v1/admin/access/services/SVC-A/owners/remove'],
    ['관리자 목록', (b) => b.access.listAdmins(), '/install/v1/admin/access/admins'],
    ['관리자 부여', (b) => b.access.addAdmin('a@company.com'), '/install/v1/admin/access/admins'],
    ['관리자 회수', (b) => b.access.removeAdmin('a@company.com'),
      '/install/v1/admin/access/admins/remove'],
    ['요청 목록', (b) => b.access.listRequests('PENDING', 0, 5),
      '/install/v1/admin/access/permission-access?status=PENDING&page=0&size=5'],
    ['요청 상세', (b) => b.access.getRequest(7), '/install/v1/admin/access/permission-access/7'],
    ['승인', (b) => b.access.approveRequest(7, '확인했어요'),
      '/install/v1/admin/access/permission-access/7/approve'],
    ['반려', (b) => b.access.rejectRequest(7, '담당자가 아니에요'),
      '/install/v1/admin/access/permission-access/7/reject'],
    ['이력', (b) => b.access.listHistory({ serviceCode: 'SVC-A' }, 0, 5),
      '/install/v1/admin/access/history?service_code=SVC-A&page=0&size=5'],
  ];

  it.each(cases)('%s', async (_label, call, expected) => {
    await expect(urlOf(call)).resolves.toBe(expected);
  });

  // 사용자 쪽은 admin 게이트 밖이라 base 가 다르다 — 같이 옮기면 요청자가 못 부른다.
  it('요청 생성·본인 신청 내역은 `/admin` 밑이 아니다', async () => {
    await expect(urlOf((b) => b.access.createRequest('SVC-A', '담당자예요'))).resolves.toBe(
      '/install/v1/services/SVC-A/permission-access',
    );
    vi.restoreAllMocks();
    vi.resetModules();
    await expect(urlOf((b) => b.access.listMyRequests('REJECTED', 0, 5))).resolves.toBe(
      '/install/v1/user/permission-access?status=REJECTED&page=0&size=5',
    );
  });
});
