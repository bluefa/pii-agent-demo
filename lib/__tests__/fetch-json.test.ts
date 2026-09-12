// @vitest-environment jsdom
// The 401 branch is browser-only (`typeof window`), so this file needs a window to
// prove it fires. Nothing else here reads the DOM: under jsdom the locale cookie is
// empty, which is the Korean default these tests already assume.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson } from '@/lib/fetch-json';
import { AppError } from '@/lib/errors';

const { redirectToSsoLoginMock } = vi.hoisted(() => ({ redirectToSsoLoginMock: vi.fn() }));

// Mocked rather than observed through `window.location`: jsdom refuses a real
// navigation. What the wrapper hands off to is pinned in lib/__tests__/sso-login.test.ts.
vi.mock('@/lib/sso-login', () => ({
  redirectToSsoLogin: redirectToSsoLoginMock,
  ssoLoginPath: (returnTo: string) => `/sso/login?returnTo=${encodeURIComponent(returnTo)}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** fetchJson 호출 후 AppError를 catch하여 반환 */
async function expectAppError(url: string, options?: Parameters<typeof fetchJson>[1]): Promise<AppError> {
  try {
    await fetchJson(url, options);
    throw new Error('Expected fetchJson to throw');
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
}

function mockFetch(status: number, body?: unknown, headers?: Record<string, string>) {
  const resHeaders = new Headers(headers);
  if (!resHeaders.has('content-type')) {
    resHeaders.set('content-type', 'application/json');
  }

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body !== undefined ? JSON.stringify(body) : null, {
      status,
      headers: resHeaders,
    }),
  );
}

function mockFetchText(status: number, text: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(text, {
      status,
      headers: { 'content-type': 'text/plain' },
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJson — 정상 응답', () => {
  it('200 JSON 응답을 파싱한다', async () => {
    mockFetch(200, { id: 1, name: 'test' });
    const data = await fetchJson<{ id: number; name: string }>('/api/v1/test');
    expect(data).toEqual({ id: 1, name: 'test' });
  });

  it('204 No Content → undefined를 반환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const data = await fetchJson('/api/v1/test');
    expect(data).toBeUndefined();
  });

  it('POST body를 JSON.stringify하고 Content-Type을 설정한다', async () => {
    const spy = mockFetch(200, { ok: true });
    await fetchJson('/api/v1/test', { method: 'POST', body: { key: 'value' } });

    const [, init] = spy.mock.calls[0];
    expect(init?.body).toBe('{"key":"value"}');
    expect(new Headers(init?.headers as HeadersInit).get('content-type')).toBe('application/json');
  });

  it('body가 없으면 Content-Type을 설정하지 않는다', async () => {
    const spy = mockFetch(200, { ok: true });
    await fetchJson('/api/v1/test');

    const [, init] = spy.mock.calls[0];
    expect(new Headers(init?.headers as HeadersInit).has('content-type')).toBe(false);
  });
});

describe('fetchJson — ProblemDetails 에러', () => {
  it('서버 code가 있으면 그대로 사용한다', async () => {
    mockFetch(404, { code: 'NOT_FOUND', detail: '리소스를 찾을 수 없습니다.' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('리소스를 찾을 수 없습니다.');
    expect(err.status).toBe(404);
  });

  it('서버 code가 없으면 status 기반 fallback을 사용한다', async () => {
    mockFetch(403, { detail: '권한 없음' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('FORBIDDEN');
  });

  it('미정의 서버 code는 경고 후 status fallback을 사용한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(400, { code: 'SOME_NEW_CODE', detail: '새로운 에러' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('BAD_REQUEST');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error code: "SOME_NEW_CODE"'),
    );
  });

  /**
   * 좁힌 코드와 받은 코드는 서로 다른 질문의 답이다. `code` 는 화면이 분기하는 값이라
   * allowlist 를 넘지 못하면 status 에서 유도한 값으로 대체되는데, 그 대체를 그대로
   * 보여주면 운영자는 서버가 한 적 없는 말을 티켓에 옮겨 적는다. `rawCode` 는 대체 전의
   * 문자열을 들고 있고, `code` 의 동작은 예전 그대로다.
   */
  it('미정의 code 도 rawCode 에는 그대로 남는다 — code 는 종전대로 좁혀진다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(409, { code: 'PIPELINE_RUNNING', detail: '진행 중인 파이프라인이 있습니다.' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('CONFLICT');
    expect(err.rawCode).toBe('PIPELINE_RUNNING');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error code: "PIPELINE_RUNNING"'),
    );
  });

  // 이 코드는 상류가 아니라 우리 라우트가 낸다. allowlist 에서 빠지면 status 로 접혀
  // CONFLICT 가 되고, 확인 모달이 "이미 진행 중" + 다시 요청하기를 내놓는다.
  it('CONFLICT_STALE_TARGET_LIST 는 아는 code 라 status 로 접히지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(409, { code: 'CONFLICT_STALE_TARGET_LIST', detail: '연동 대상 목록이 변경되었습니다.' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('CONFLICT_STALE_TARGET_LIST');
    expect(warn).not.toHaveBeenCalled();
  });

  it('아는 code 면 둘이 같은 값이고, code 가 없으면 rawCode 도 없다', async () => {
    mockFetch(404, { code: 'NOT_FOUND', detail: '없습니다.' });
    const known = await expectAppError('/api/v1/test');
    expect(known.rawCode).toBe('NOT_FOUND');
    expect(known.code).toBe('NOT_FOUND');

    vi.restoreAllMocks();
    // 서버가 code 를 아예 안 보내면 지어내지 않는다 — status fallback 은 `code` 몫이다.
    mockFetch(403, { detail: '권한 없음' });
    const bare = await expectAppError('/api/v1/test');
    expect(bare.rawCode).toBeUndefined();
    expect(bare.code).toBe('FORBIDDEN');
  });

  it('retriable: 서버 값을 우선한다', async () => {
    mockFetch(500, { code: 'INTERNAL_ERROR', detail: '에러', retriable: false });

    const err = await expectAppError('/api/v1/test');
    expect(err.retriable).toBe(false);
  });

  it('retriable: 서버 값 없으면 429/5xx는 true', async () => {
    mockFetch(429, { detail: '요청 초과' });
    const err429 = await expectAppError('/api/v1/test');
    expect(err429.retriable).toBe(true);

    mockFetch(502, { detail: '게이트웨이 에러' });
    const err502 = await expectAppError('/api/v1/test');
    expect(err502.retriable).toBe(true);
  });

  it('retriable: 4xx(429 제외)는 false', async () => {
    mockFetch(400, { detail: '잘못된 요청' });
    const err = await expectAppError('/api/v1/test');
    expect(err.retriable).toBe(false);
  });

  it('Retry-After 헤더를 파싱한다', async () => {
    mockFetch(429, { detail: '요청 초과' }, { 'Retry-After': '60' });

    const err = await expectAppError('/api/v1/test');
    expect(err.retryAfterMs).toBe(60_000);
  });

  it('서버 retryAfterMs가 Retry-After 헤더보다 우선한다', async () => {
    mockFetch(429, { detail: '요청 초과', retryAfterMs: 5000 }, { 'Retry-After': '60' });

    const err = await expectAppError('/api/v1/test');
    expect(err.retryAfterMs).toBe(5000);
  });

  it('x-request-id 헤더를 전달한다', async () => {
    mockFetch(500, { detail: '에러' }, { 'x-request-id': 'req-123' });

    const err = await expectAppError('/api/v1/test');
    expect(err.requestId).toBe('req-123');
  });

  it('body.requestId가 헤더보다 우선한다', async () => {
    mockFetch(500, { detail: '에러', requestId: 'body-456' }, { 'x-request-id': 'header-123' });

    const err = await expectAppError('/api/v1/test');
    expect(err.requestId).toBe('body-456');
  });

  it('timestamp는 UTC ISO-8601 문자열 그대로 보존한다', async () => {
    mockFetch(500, {
      timestamp: '2026-04-29T02:27:09.123Z',
      code: 'INTERNAL_ERROR',
      detail: '에러',
    });

    const err = await expectAppError('/api/v1/test');
    expect(err.timestamp).toBe('2026-04-29T02:27:09.123Z');
  });
});

describe('fetchJson — JSON 파싱 실패', () => {
  it('비-JSON 에러 응답은 status 기반으로 처리한다', async () => {
    mockFetchText(500, 'Internal Server Error');

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe('HTTP 500');
  });

  it('비-JSON 429 응답도 retriable: true', async () => {
    mockFetchText(429, 'Too Many Requests');

    const err = await expectAppError('/api/v1/test');
    expect(err.retriable).toBe(true);
  });
});

describe('fetchJson — 네트워크/타임아웃', () => {
  it('TypeError → NETWORK 에러', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('NETWORK');
    expect(err.retriable).toBe(true);
    expect(err.status).toBe(0);
  });

  it('타임아웃 → TIMEOUT 에러', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 100);
      }),
    );

    const err = await expectAppError('/api/v1/test', { timeout: 50 });
    expect(err.code).toBe('TIMEOUT');
    expect(err.retriable).toBe(true);
  });

  it('외부 signal abort → ABORTED 에러', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 100);
      }),
    );

    setTimeout(() => controller.abort(), 10);

    const err = await expectAppError('/api/v1/test', { signal: controller.signal });
    expect(err.code).toBe('ABORTED');
    expect(err.retriable).toBe(false);
  });

  it('이미 aborted된 signal → 즉시 ABORTED 에러', async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, reject) => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }),
    );

    const err = await expectAppError('/api/v1/test', { signal: controller.signal });
    expect(err.code).toBe('ABORTED');
  });

  // Chrome 실제 동작: abort(reason) 의 reason 이 문자열이면 fetch 가
  // DOMException 이 아닌 그 문자열을 그대로 reject 한다. 이 케이스를
  // 놓치면 UNKNOWN 으로 떨어져 빨간 카드에 "알 수 없는 오류가 발생했습니다."
  // 가 노출된다. (회귀 방지)
  it('fetch가 string reason으로 reject되어도 ABORTED로 매핑된다', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, reject) => {
        // 외부 signal abort → 내부 controller 도 abort('ABORTED') 됨
        // → fetch 가 string 'ABORTED' 로 reject (Chrome 실제 동작)
        setTimeout(() => reject('ABORTED'), 50);
      }),
    );

    setTimeout(() => controller.abort(), 10);

    const err = await expectAppError('/api/v1/test', { signal: controller.signal });
    expect(err.code).toBe('ABORTED');
    expect(err.message).not.toContain('알 수 없는');
  });

  it('타임아웃 시 fetch가 string reason으로 reject되어도 TIMEOUT으로 매핑된다', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject('TIMEOUT'), 100);
      }),
    );

    const err = await expectAppError('/api/v1/test', { timeout: 50 });
    expect(err.code).toBe('TIMEOUT');
    expect(err.retriable).toBe(true);
  });
});

describe('fetchJson — status 매핑', () => {
  const cases: [number, string][] = [
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [503, 'INTERNAL_ERROR'],
  ];

  it.each(cases)('HTTP %d → %s', async (status, expectedCode) => {
    mockFetch(status, { detail: 'test' });
    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe(expectedCode);
    expect(err.status).toBe(status);
  });
});

describe('fetchJson — Headers 병합', () => {
  it('Headers 인스턴스를 안전하게 처리한다', async () => {
    const spy = mockFetch(200, { ok: true });
    const customHeaders = new Headers({ Authorization: 'Bearer token' });

    await fetchJson('/api/v1/test', { headers: customHeaders, body: { a: 1 } });

    const [, init] = spy.mock.calls[0];
    const sent = new Headers(init?.headers as HeadersInit);
    expect(sent.get('authorization')).toBe('Bearer token');
    expect(sent.get('content-type')).toBe('application/json');
  });

  it('plain object headers를 안전하게 처리한다', async () => {
    const spy = mockFetch(200, { ok: true });

    await fetchJson('/api/v1/test', {
      headers: { 'X-Custom': 'value' },
      body: { a: 1 },
    });

    const [, init] = spy.mock.calls[0];
    const sent = new Headers(init?.headers as HeadersInit);
    expect(sent.get('x-custom')).toBe('value');
    expect(sent.get('content-type')).toBe('application/json');
  });
});

// 파일 업로드가 이 래퍼를 쓸 수 있어야 타임아웃·네트워크 정규화를 같이 받는다.
// 그 전에는 raw fetch 로 빠져 있었고, 그래서 BFF 가 죽으면 브라우저의
// "Failed to fetch" 가 한국어 UI 에 그대로 나왔다.
describe('fetchJson — FormData 본문', () => {
  it('Content-Type 을 정하지 않는다 — boundary 는 fetch 가 붙인다', async () => {
    const spy = mockFetch(200, { url: '/img/1.png' });
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/png' }));

    await fetchJson('/api/v1/admin/posts/images', { method: 'POST', body: form });

    const [, init] = spy.mock.calls[0];
    expect(new Headers(init?.headers as HeadersInit).get('content-type')).toBeNull();
  });

  it('직렬화하지 않고 그대로 넘긴다', async () => {
    const spy = mockFetch(200, { url: '/img/1.png' });
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/png' }));

    await fetchJson('/api/v1/admin/posts/images', { method: 'POST', body: form });

    expect(spy.mock.calls[0][1]?.body).toBe(form);
  });

});

/**
 * ADR-008 §91: 401 is *always* an expired/absent SSO session, never a permission
 * verdict. `proxy.ts` only checks that the cookie exists, so an expired one walks
 * past the gate and surfaces here — and a background poller (installation status
 * every 30s, TC every 4s) would otherwise paint an error card for a session that
 * only needs renewing.
 */
describe('fetchJson — 401 은 재로그인으로 이어진다', () => {
  beforeEach(() => {
    redirectToSsoLoginMock.mockClear();
  });

  it('401 이면 SSO 로그인으로 보내고, 그래도 AppError 를 던진다', async () => {
    mockFetch(401, { code: 'BFF_AUTHENTICATION_FAILED', detail: 'token expired' });

    // 리다이렉트만으로는 부족하다 — 호출자는 멈춰야 하고, 멈추게 하는 건 throw 다.
    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.status).toBe(401);
    expect(redirectToSsoLoginMock).toHaveBeenCalledTimes(1);
  });

  // 401 만이 만료다. 403 은 판정이고, 로그인을 다시 해도 답이 바뀌지 않는다.
  it.each([400, 403, 404, 409, 500, 503])('%d 는 로그인으로 보내지 않는다', async (status) => {
    mockFetch(status, { detail: 'nope' });

    await expectAppError('/api/v1/test');
    expect(redirectToSsoLoginMock).not.toHaveBeenCalled();
  });

  it('성공 응답은 아무 데도 보내지 않는다', async () => {
    mockFetch(200, { ok: true });

    await fetchJson('/api/v1/test');
    expect(redirectToSsoLoginMock).not.toHaveBeenCalled();
  });
});
