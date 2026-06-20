import { afterEach, describe, expect, it, vi } from 'vitest';

describe('httpBff.users.me', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('returns the flat Issue #222 payload as-is (route layer extracts)', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'user-1',
          name: '홍길동',
          email: 'hong@company.com',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { httpBff } = await import('@/lib/bff/http');

    await expect(httpBff.users.me()).resolves.toEqual({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/user/me',
      {
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('returns wrapped { user } payloads as-is (route layer extracts)', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            name: '홍길동',
            email: 'hong@company.com',
            role: 'ADMIN',
            service_code_permissions: ['SERVICE-A'],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { httpBff } = await import('@/lib/bff/http');

    await expect(httpBff.users.me()).resolves.toEqual({
      user: {
        id: 'user-1',
        name: '홍길동',
        email: 'hong@company.com',
        role: 'ADMIN',
        serviceCodePermissions: ['SERVICE-A'],
      },
    });
  });
});

describe('httpBff snake-raw passthrough (getSnakeRaw)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('azure.getScanApp returns the snake_case body verbatim (no camelCasing)', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    const snakeBody = {
      app_id: 'app-1',
      status: 'SUCCESS',
      fail_reason: null,
      fail_message: null,
      last_verified_at: '2026-01-01T00:00:00Z',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(snakeBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');

    // last_verified_at must NOT become lastVerifiedAt — getSnakeRaw skips camelCaseKeys.
    await expect(httpBff.azure.getScanApp(123)).resolves.toEqual(snakeBody);
  });
});
