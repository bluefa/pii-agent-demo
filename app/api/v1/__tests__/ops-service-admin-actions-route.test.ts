/**
 * 서비스 운영 상세의 두 버튼이 타는 길. 둘 다 본문 없는 쓰기라 라우트가 옮기는 값은
 * 경로의 `serviceCode` **하나**뿐이다 — 그 한 칸이 어긋나면 다른 서비스에 종료가
 * 걸리고, 응답 본문이 없으니 화면은 성공만 본다.
 *
 * 두 층을 따로 잰다:
 *   1. 라우트는 디코딩된 원본 코드를 bff 에 넘긴다 (인코딩은 여기서 하지 않는다).
 *   2. http 어댑터는 그 코드를 `enc()` 로 감싸 업스트림 경로를 만든다.
 * 라우트 테스트가 `@/lib/bff/client` 를 모킹하는 이상 1번만으로는 2번이 안 보인다 —
 * 그래서 fetch 를 세워 실제로 나가는 URL 을 같이 못 박는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    ops: {
      updateServiceInstalled: vi.fn(),
      endOfService: vi.fn(),
    },
  },
}));

import { POST as postServiceInstalled } from '@/app/api/v1/admin/ops/services/[serviceCode]/service-installed/route';
import { POST as postEndOfService } from '@/app/api/v1/admin/ops/services/[serviceCode]/end-of-service/route';
import { bff } from '@/lib/bff/client';

/** 인코딩이 필요한 문자를 품은 코드 — 공백과 `/` 둘 다 경로에서 살아남으면 안 된다. */
const RAW_CODE = 'ORD/주문 서비스';

const call = (
  handler: (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  segment: string,
) =>
  handler(
    new Request(
      `http://localhost/pass/api/v1/admin/ops/services/${encodeURIComponent(RAW_CODE)}/${segment}`,
      { method: 'POST' },
    ),
    { params: Promise.resolve({ serviceCode: RAW_CODE }) },
  );

describe('POST …/admin/ops/services/[serviceCode]/{service-installed,end-of-service}', () => {
  beforeEach(() => vi.clearAllMocks());

  it('설치 상태 갱신은 그 서비스코드 그대로 bff.ops.updateServiceInstalled 를 부른다', async () => {
    const res = await call(postServiceInstalled, 'service-installed');

    expect(vi.mocked(bff.ops.updateServiceInstalled)).toHaveBeenCalledWith(RAW_CODE);
    expect(vi.mocked(bff.ops.endOfService)).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('서비스 종료는 그 서비스코드 그대로 bff.ops.endOfService 를 부른다', async () => {
    const res = await call(postEndOfService, 'end-of-service');

    expect(vi.mocked(bff.ops.endOfService)).toHaveBeenCalledWith(RAW_CODE);
    expect(vi.mocked(bff.ops.updateServiceInstalled)).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

const BASE = 'https://bff.example.com';

/** 위 라우트가 넘긴 코드를 http 어댑터가 실제로 어떤 URL 로 바꾸는지. */
async function upstreamRequest(method: 'updateServiceInstalled' | 'endOfService') {
  process.env.BFF_API_URL = BASE;
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 204 }));
  const { httpBff } = await import('@/lib/bff/http');
  await httpBff.ops[method](RAW_CODE);
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return { path: String(url).replace(BASE, ''), init: init as RequestInit };
}

describe('httpBff.ops — serviceCode 는 경로에 인코딩되어 실린다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('update-service-installed', async () => {
    const { path, init } = await upstreamRequest('updateServiceInstalled');
    expect(path).toBe(
      '/install/v1/service-infos/ORD%2F%EC%A3%BC%EB%AC%B8%20%EC%84%9C%EB%B9%84%EC%8A%A4/update-service-installed',
    );
    expect(init.method).toBe('POST');
    // 본문 없는 쓰기 — 빈 객체라도 실으면 Content-Type 이 붙는다.
    expect(init.body).toBeUndefined();
  });

  it('end-of-service', async () => {
    const { path, init } = await upstreamRequest('endOfService');
    expect(path).toBe(
      '/install/v1/service-infos/ORD%2F%EC%A3%BC%EB%AC%B8%20%EC%84%9C%EB%B9%84%EC%8A%A4/end-of-service',
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});
