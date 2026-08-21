import { relayAuthRedirect } from '@/app/sso/_lib/relay';

/**
 * AD SSO login entry — GET /pass/sso/login?returnTo=/pass/...
 *
 * The BFF owns the whole OIDC dance (state/nonce, ADFS URL, client id); this
 * route only relays its 302 + temp cookie. `redirect: 'manual'` is mandatory:
 * without it fetch follows the 302 to ADFS and the Location + Set-Cookie are
 * lost. `no-store` because every call mints a fresh state/nonce — a cached
 * response would replay one.
 */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('returnTo');
  // Local-path allowlist: the BFF echoes returnTo as the post-login Location,
  // so an absolute or protocol-relative value here would be an open redirect.
  const returnTo = requested?.startsWith('/pass') ? requested : '/pass';
  const upstream = await fetch(
    `${process.env.BFF_API_URL}/install/v1/auth/ad-sso/login?returnTo=${encodeURIComponent(returnTo)}`,
    { redirect: 'manual', cache: 'no-store' },
  );
  return relayAuthRedirect(upstream);
}
