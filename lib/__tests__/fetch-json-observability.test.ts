// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const okResponse = (body: unknown = { ok: true }): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('fetchJson observability context', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches X-Request-Id, X-Client-Page, and X-Client-Action headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const { fetchJson } = await import('@/lib/fetch-json');

    await fetchJson('/integration/api/v1/thing?q=secret', { method: 'POST', body: {}, action: 'saveThing' });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('X-Request-Id')).toMatch(/^[0-9a-fA-F-]{8,64}$/);
    // jsdom default location.pathname is '/'
    expect(headers.get('X-Client-Page')).toBe('/');
    expect(headers.get('X-Client-Action')).toBe('saveThing');
  });

  it('omits X-Client-Action when no action is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const { fetchJson } = await import('@/lib/fetch-json');

    await fetchJson('/integration/api/v1/thing');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('X-Client-Action')).toBeNull();
    expect(headers.get('X-Request-Id')).toBeTruthy();
  });

  it('records ring-buffer entries with the query string stripped', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const { fetchJson, getRecentApiCalls } = await import('@/lib/fetch-json');

    await fetchJson('/integration/api/v1/thing?q=secret', { method: 'GET' });

    const calls = getRecentApiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/integration/api/v1/thing');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].status).toBe(200);
    expect(calls[0].requestId).toMatch(/^[0-9a-fA-F-]{8,64}$/);
  });

  it('records a failed call and keeps only the last 10 entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('boom')) {
        return new Response(JSON.stringify({ detail: 'nope' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return okResponse();
    });
    const { fetchJson, getRecentApiCalls } = await import('@/lib/fetch-json');

    for (let i = 0; i < 11; i += 1) {
      await fetchJson(`/integration/api/v1/ok-${i}`).catch(() => {});
    }
    await fetchJson('/integration/api/v1/boom').catch(() => {});

    const calls = getRecentApiCalls();
    expect(calls).toHaveLength(10);
    expect(calls[calls.length - 1].path).toBe('/integration/api/v1/boom');
    expect(calls[calls.length - 1].status).toBe(500);
  });

  it('records status 0 for a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed to fetch'));
    const { fetchJson, getRecentApiCalls } = await import('@/lib/fetch-json');

    await fetchJson('/integration/api/v1/down').catch(() => {});

    const calls = getRecentApiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe(0);
  });

  it('aborted-request console.debug never contains query data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 50);
        }),
    );
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { fetchJson } = await import('@/lib/fetch-json');

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    await fetchJson('/integration/api/v1/users/search?q=hong', { signal: controller.signal }).catch(() => {});

    const logged = debugSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('/integration/api/v1/users/search');
    expect(logged).not.toContain('q=hong');
  });

  it('debug-logs the method + query-stripped path only, never the body/init', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { fetchJson } = await import('@/lib/fetch-json');

    await fetchJson('/integration/api/v1/users/search?q=hong', {
      method: 'POST',
      body: { secretField: 'sensitive-value' },
    });

    const logged = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('/integration/api/v1/users/search');
    expect(logged).not.toContain('q=hong');
    expect(logged).not.toContain('sensitive-value');
  });
});
