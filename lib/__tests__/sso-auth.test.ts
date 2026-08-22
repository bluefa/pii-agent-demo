import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * AD SSO — login/callback relay routes + proxy auth gate.
 *
 * The BFF (PR #8646) owns state/nonce/session; the frontend only relays.
 * These tests pin the relay invariants the handoff calls out: redirect:
 * 'manual', getSetCookie() (two cookies must not be comma-folded), the
 * literal /pass prefix on returnTo, and the proxy matcher exclusions.
 */

const BFF = 'https://bff.example.com';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BFF_API_URL;
  delete process.env.USE_MOCK_DATA;
});

beforeEach(() => {
  process.env.BFF_API_URL = BFF;
});

describe('GET /sso/login', () => {
  it('relays the BFF 302 (Location + temp cookie) without following it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: [
          ['location', 'https://adfs.example.com/adfs/oauth2/authorize?...'],
          ['set-cookie', 'AD_SSO_TMP=state-nonce; Path=/; HttpOnly'],
        ],
      }),
    );

    const { GET } = await import('@/app/sso/login/route');
    const res = await GET(
      new Request('http://localhost:3000/pass/sso/login?returnTo=%2Fpass%2Fservices'),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      `${BFF}/install/v1/auth/ad-sso/login?returnTo=%2Fpass%2Fservices`,
      { redirect: 'manual', cache: 'no-store' },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://adfs.example.com/adfs/oauth2/authorize?...',
    );
    expect(res.headers.getSetCookie()).toEqual(['AD_SSO_TMP=state-nonce; Path=/; HttpOnly']);
  });

  it('defaults returnTo to /pass when absent', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: 'x' } }));

    const { GET } = await import('@/app/sso/login/route');
    await GET(new Request('http://localhost:3000/pass/sso/login'));

    expect(fetchSpy).toHaveBeenCalledWith(
      `${BFF}/install/v1/auth/ad-sso/login?returnTo=%2Fpass`,
      expect.anything(),
    );
  });

  it('rejects a non-local returnTo (open-redirect guard)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: 'x' } }));

    const { GET } = await import('@/app/sso/login/route');
    for (const evil of [
      'https://evil.example/phish',
      '//evil.example/phish',
      '/services', // local but missing the /pass prefix — would 404 after login
    ]) {
      await GET(
        new Request(`http://localhost:3000/pass/sso/login?returnTo=${encodeURIComponent(evil)}`),
      );
      expect(fetchSpy).toHaveBeenLastCalledWith(
        `${BFF}/install/v1/auth/ad-sso/login?returnTo=%2Fpass`,
        expect.anything(),
      );
    }
  });
});

describe('POST /sso/adssoLogin', () => {
  it('forwards form body + temp cookie, relays both Set-Cookie headers separately', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: [
          ['location', '/pass/services'],
          ['set-cookie', 'pass-adsso-token=abc; Path=/; HttpOnly; Secure'],
          ['set-cookie', 'AD_SSO_TMP=; Path=/; Max-Age=0'],
        ],
      }),
    );

    const { POST } = await import('@/app/sso/adssoLogin/route');
    const res = await POST(
      new Request('http://localhost:3000/pass/sso/adssoLogin', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: 'AD_SSO_TMP=state-nonce',
        },
        body: 'id_token=jwt&state=xyz',
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(`${BFF}/install/v1/auth/ad-sso/callback`, {
      method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: 'AD_SSO_TMP=state-nonce',
      },
      body: 'id_token=jwt&state=xyz',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/pass/services');
    // Two entries — a comma-folded single header would corrupt both cookies.
    expect(res.headers.getSetCookie()).toEqual([
      'pass-adsso-token=abc; Path=/; HttpOnly; Secure',
      'AD_SSO_TMP=; Path=/; Max-Age=0',
    ]);
  });

  it('relays a non-302 BFF error status as-is', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"code":"BFF_AUTHENTICATION_FAILED"}', {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { POST } = await import('@/app/sso/adssoLogin/route');
    const res = await POST(
      new Request('http://localhost:3000/pass/sso/adssoLogin', {
        method: 'POST',
        body: 'error=access_denied&error_description=denied',
      }),
    );

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('{"code":"BFF_AUTHENTICATION_FAILED"}');
  });
});

describe('proxy (auth gate)', () => {
  it('redirects a session-less page load to /sso/login with a /pass-prefixed returnTo', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(new NextRequest('http://localhost:3000/services?tab=aws'));

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '');
    expect(target.pathname).toBe('/sso/login');
    expect(target.searchParams.get('returnTo')).toBe('/pass/services?tab=aws');
  });

  it('passes through when the session cookie is present', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(
      new NextRequest('http://localhost:3000/services', {
        headers: { cookie: 'pass-adsso-token=abc' },
      }),
    );

    expect(res.headers.get('location')).toBeNull();
  });

  it('passes through in mock mode (no BFF to log into)', async () => {
    process.env.USE_MOCK_DATA = 'true';
    const { proxy } = await import('@/proxy');
    const res = proxy(new NextRequest('http://localhost:3000/services'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('matcher excludes sso/, api/, _next/ and static files but matches pages', async () => {
    const { config } = await import('@/proxy');
    // path-to-regexp compiles the matcher's inner pattern anchored to the path.
    const pattern = new RegExp(`^${config.matcher[0]}$`);

    expect('/services').toMatch(pattern);
    expect('/admin/pipelines').toMatch(pattern);
    expect('/').toMatch(pattern);

    // Dotted page URLs must stay gated — a bare "contains a dot" exclusion
    // let any dynamic-segment URL with a dot bypass the auth gate entirely
    // (found by cross-review on PR #744).
    expect('/target-sources/1.2').toMatch(pattern);
    expect('/target-sources/1.').toMatch(pattern);
    expect('/services.').toMatch(pattern);
    expect('/swagger/aws.yaml').toMatch(pattern);
    expect('/access-requests/x.y').toMatch(pattern);

    // Exclusions — a match here would loop the login redirect or break assets.
    expect('/sso/login').not.toMatch(pattern);
    expect('/sso/adssoLogin').not.toMatch(pattern);
    expect('/api/v1/users/search').not.toMatch(pattern);
    expect('/_next/static/chunk.js').not.toMatch(pattern);
    expect('/favicon.ico').not.toMatch(pattern);
    expect('/fonts/Pretendard.woff2').not.toMatch(pattern);
    expect('/next.svg').not.toMatch(pattern);
  });
});
