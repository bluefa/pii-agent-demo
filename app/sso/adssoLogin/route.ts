import { relayAuthRedirect } from '@/app/sso/_lib/relay';

/**
 * AD SSO callback — POST /pass/sso/adssoLogin
 *
 * ADFS form-posts id_token + state here (path spelling matches the registered
 * OIDC redirect URI case-sensitively — renaming this folder breaks auth).
 * The form body and the temp cookie are forwarded verbatim; the BFF verifies
 * and answers 302 (returnTo) + two Set-Cookie headers (session + temp-cookie
 * deletion), which relayAuthRedirect passes through individually.
 */
export async function POST(request: Request) {
  const cookie = request.headers.get('cookie');
  const upstream = await fetch(`${process.env.BFF_API_URL}/install/v1/auth/ad-sso/callback`, {
    method: 'POST',
    redirect: 'manual',
    cache: 'no-store',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: await request.text(),
  });
  return relayAuthRedirect(upstream);
}
