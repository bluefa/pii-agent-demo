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
        service_code_permissions: ['SERVICE-A'],
      },
    });
  });
});
