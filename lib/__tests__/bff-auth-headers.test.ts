import { afterEach, describe, expect, it, vi } from 'vitest';

// Simulates the Next.js request scope: `headers()` returns the inbound headers.
const inbound = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => inbound.current.get(name.toLowerCase()) ?? null,
  }),
}));

describe('BFF auth header passthrough (IAP/SSO)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    inbound.current = new Map();
    delete process.env.BFF_API_URL;
  });

  it('forwards only allowlisted auth headers on GET', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    inbound.current = new Map([
      ['authorization', 'Bearer sso-token'],
      ['cookie', 'GCP_IAAP_AUTH_TOKEN=iap-cookie'],
      ['x-goog-iap-jwt-assertion', 'iap-jwt'],
      ['x-goog-authenticated-user-email', 'accounts.google.com:user@company.com'],
      ['x-forwarded-for', '10.0.0.1'],
      ['user-agent', 'test-agent'],
    ]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');
    await httpBff.users.me();

    expect(fetchSpy).toHaveBeenCalledWith('https://bff.example.com/install/v1/user/me', {
      headers: {
        Accept: 'application/json',
        authorization: 'Bearer sso-token',
        cookie: 'GCP_IAAP_AUTH_TOKEN=iap-cookie',
        'x-goog-iap-jwt-assertion': 'iap-jwt',
        'x-goog-authenticated-user-email': 'accounts.google.com:user@company.com',
      },
    });
  });

  it('forwards auth headers on POST alongside Content-Type', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';
    inbound.current = new Map([['authorization', 'Bearer sso-token']]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');
    await httpBff.confirm.cancelApprovalRequest(1);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toEqual({
      authorization: 'Bearer sso-token',
      'Content-Type': 'application/json',
    });
  });

  it('sends no auth headers when the inbound request has none', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { httpBff } = await import('@/lib/bff/http');
    await httpBff.users.me();

    expect(fetchSpy).toHaveBeenCalledWith('https://bff.example.com/install/v1/user/me', {
      headers: { Accept: 'application/json' },
    });
  });
});
