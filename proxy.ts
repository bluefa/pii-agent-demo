import { NextResponse, type NextRequest } from 'next/server';
import { isMock } from '@/lib/env';

// TODO: confirm the session cookie name issued by BFF PR #8646.
const SESSION_COOKIE = 'SESSION';

/**
 * AD SSO gate: page loads without a session cookie are sent to /sso/login,
 * which relays the BFF's redirect to ADFS.
 *
 * Presence check only — the BFF owns validity. An expired-but-present cookie
 * passes here and surfaces as API 401s (BFF_AUTHENTICATION_FAILED, ADR-008).
 */
export function proxy(request: NextRequest) {
  // Local mock dev has no BFF to log into.
  if (isMock()) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  // nextUrl.pathname has basePath stripped (`/services`). The redirect URL
  // gets the basePath re-attached by NextURL itself, but returnTo travels as
  // a literal query value, so it must carry the `/pass` prefix explicitly or
  // the post-login redirect lands on a 404 (basePath, next.config.ts).
  const url = request.nextUrl.clone();
  const returnTo = `/pass${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = '/sso/login';
  url.search = `returnTo=${encodeURIComponent(returnTo)}`;
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
