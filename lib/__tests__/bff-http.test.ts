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

describe('httpBff PUT with an empty 200 body', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('resolves to undefined instead of throwing on JSON.parse', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('   ', { status: 200 }));

    const { httpBff } = await import('@/lib/bff/http');

    await expect(
      httpBff.logicalDb.updateExcludedByResourceId(1545, 'arn:aws:rds:db', {
        skip_logical_database_list: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('still throws for callers that did not opt in', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));

    const { httpBff } = await import('@/lib/bff/http');

    await expect(httpBff.confirm.createApprovalRequest(1545, {})).rejects.toThrow(SyntaxError);
  });
});
