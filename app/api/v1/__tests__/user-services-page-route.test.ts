import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    users: {
      getServicesPage: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/user/services/page/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type PageServiceItem = z.infer<typeof schemas.PageServiceItem>;

const mockedGetServicesPage = vi.mocked(bff.users.getServicesPage);

describe('GET /pass/api/v1/user/services/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns snake wire PageServiceItem validated by zod schema', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [
        { service_code: 'SERVICE-A', service_name: '서비스 A' },
        { service_code: 'SERVICE-B', service_name: '서비스 B' },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 10,
    } as PageServiceItem);

    const response = await GET(
      new Request('http://localhost/pass/api/v1/user/services/page?page=0&size=10'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: [
        { service_code: 'SERVICE-A', service_name: '서비스 A' },
        { service_code: 'SERVICE-B', service_name: '서비스 B' },
      ],
    });
    expect(mockedGetServicesPage).toHaveBeenCalledWith(0, 10, undefined);
  });

  it('reads Spring Page envelope metadata', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [{ service_code: 'SERVICE-A', service_name: '서비스 A' }],
      totalElements: 42,
      totalPages: 5,
      number: 1,
      size: 10,
    } as PageServiceItem);

    const response = await GET(
      new Request('http://localhost/pass/api/v1/user/services/page?page=1&size=10'),
      { params: Promise.resolve({}) },
    );

    await expect(response.json()).resolves.toMatchObject({
      totalElements: 42,
      totalPages: 5,
      number: 1,
      size: 10,
    });
  });

  /**
   * 서비스 헤더의 EOS 뱃지가 통째로 이 동작 하나에 얹혀 있다.
   *
   * `ServiceItem` 계약은 `{service_code, service_name}` 뿐이라 `is_eos_service` 는
   * 스키마에 **없는** 키다. 그럼에도 화면이 그 값을 읽을 수 있는 이유는 생성 스키마가
   * `.partial().passthrough()` 이기 때문 — `parse()` 가 모르는 키를 지우지 않는다.
   *
   * 이 가정이 깨지면(예: 코드젠 템플릿이 strip 으로 바뀌면) 뱃지는 조용히 항상
   * "운영 중"이 된다. 조용한 실패라서 화면 테스트로는 절대 안 잡힌다 — 그래서 계약이
   * 아니라 **경계**인 여기서 잡는다.
   */
  it('lets an off-contract is_eos_service survive parse (passthrough)', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [
        { service_code: 'CSC', service_name: '고객센터', is_eos_service: true },
        { service_code: 'CPN', service_name: '쿠폰', is_eos_service: false },
        { service_code: 'ADS', service_name: '광고' },
      ],
      totalElements: 3,
      totalPages: 1,
      number: 0,
      size: 10,
    } as PageServiceItem);

    const response = await GET(
      new Request('http://localhost/pass/api/v1/user/services/page?page=0&size=10'),
      { params: Promise.resolve({}) },
    );

    const body = (await response.json()) as { content: Array<Record<string, unknown>> };
    expect(body.content[0]?.is_eos_service).toBe(true);
    expect(body.content[1]?.is_eos_service).toBe(false);
    // 안 실어 보낸 서비스는 키 자체가 없다 — false 로 메워지지 않는다.
    expect(body.content[2]).not.toHaveProperty('is_eos_service');
  });

  it('passes query string and forwards BffError as ProblemDetails', async () => {
    mockedGetServicesPage.mockRejectedValueOnce(
      new BffError(401, 'UNAUTHORIZED', '로그인이 필요합니다.'),
    );

    const response = await GET(
      new Request('http://localhost/pass/api/v1/user/services/page?page=0&size=10&query=foo'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockedGetServicesPage).toHaveBeenCalledWith(0, 10, 'foo');
  });
});
