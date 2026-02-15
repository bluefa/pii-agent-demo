import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson } from '@/lib/fetch-json';
import { AppError } from '@/lib/errors';

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

  it('flat 에러 형태 (code + message)를 파싱한다', async () => {
    mockFetch(404, { code: 'NOT_FOUND', message: 'Target Source를 찾을 수 없습니다.' });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Target Source를 찾을 수 없습니다.');
  });

  it('nested 에러 형태 (error.code + error.message)를 파싱한다', async () => {
    mockFetch(403, { error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } });

    const err = await expectAppError('/api/v1/test');
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('접근 권한이 없습니다.');
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
