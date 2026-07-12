import { afterEach, describe, it, expect, vi } from 'vitest';

describe('httpBff observability header forwarding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('outside a request scope the GET call keeps only its Accept header (forward → {})', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');
    await httpBff.users.me();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/user/me',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('outside a request scope a bodyless POST sends no headers object', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ triggered: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');
    await httpBff.confirm.testConnection(1001);

    // Bodyless POST with an empty forward map → no `headers` key leaks in.
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/target-sources/1001/test-connection/async',
      { method: 'POST' },
    );
  });

  it('logs the query-stripped upstream path, never the query string', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { httpBff } = await import('@/lib/bff/http');
    // users.search builds `/users/search?q=hong&excludeIds=secret-id`.
    await httpBff.users.search('hong', ['secret-id']);

    const logged = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('/install/v1/users/search');
    expect(logged).not.toContain('q=hong');
    expect(logged).not.toContain('secret-id');
  });
});
