import { NextResponse, type NextRequest } from 'next/server';
import { isMock } from '@/lib/env';
import { PATHNAME_HEADER } from '@/lib/sso-login';

// Session cookie issued by the BFF on the AD SSO callback (PR #8646).
const SESSION_COOKIE = 'pass-adsso-token';

// Next's cache buster on a soft navigation's RSC fetch (NEXT_RSC_UNION_QUERY).
const RSC_QUERY = '_rsc';

/**
 * Where this request should come back to after logging in again.
 *
 * nextUrl.pathname has basePath stripped (`/services`). The redirect URL gets
 * the basePath re-attached by NextURL itself, but returnTo travels as a literal
 * query value, so it must carry the `/pass` prefix explicitly or the post-login
 * redirect lands on a 404 (basePath, next.config.ts).
 *
 * `_rsc` is dropped because the request this runs on is often the RSC fetch, not
 * the address bar: kept, a stale internal hash would ride back from the login on
 * a URL the user then sees and shares. A fresh URLSearchParams — mutating
 * `nextUrl.searchParams` would edit the very URL the redirect below clones.
 */
const returnToOf = (request: NextRequest) => {
  const params = new URLSearchParams(request.nextUrl.search);
  params.delete(RSC_QUERY);
  const query = params.toString();
  return `/pass${request.nextUrl.pathname}${query ? `?${query}` : ''}`;
};

/**
 * Let the request through, telling the server which path it is rendering.
 *
 * A server component has no request URL, so a 401 caught mid-render had nowhere
 * to return to (`lib/bff/session-expired.ts`). `set`, never `append`: the value
 * ends up as a redirect target, so a client-sent header must be overwritten
 * rather than joined with the real path.
 */
const passThrough = (request: NextRequest) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, returnToOf(request));
  return NextResponse.next({ request: { headers: requestHeaders } });
};

/**
 * AD SSO gate: page loads without a session cookie are sent to /sso/login,
 * which relays the BFF's redirect to ADFS.
 *
 * Presence check only — the BFF owns validity. An expired-but-present cookie
 * passes here and surfaces as API 401s (BFF_AUTHENTICATION_FAILED, ADR-008).
 */
export function proxy(request: NextRequest) {
  // Local mock dev has no BFF to log into.
  if (isMock()) return passThrough(request);
  if (request.cookies.has(SESSION_COOKIE)) return passThrough(request);

  const url = request.nextUrl.clone();
  url.pathname = '/sso/login';
  url.search = `returnTo=${encodeURIComponent(returnToOf(request))}`;
  return NextResponse.redirect(url);
}

// sso/ and api/ must stay excluded or the login redirect recurses (the BFF
// proxy answers its own 401s). Static files are excluded by an allowlist of
// asset extensions anchored to the end of the path — a bare "contains a dot"
// exclusion would let any dotted URL (e.g. /target-sources/1.2,
// /swagger/aws.yaml) bypass the gate entirely.
export const config = {
  matcher: [
    '/((?!sso/|api/|_next/|.*\\.(?:ico|svg|png|jpe?g|gif|webp|woff2?|ttf|css|js|map|json|txt|xml)$).*)',
  ],
};
