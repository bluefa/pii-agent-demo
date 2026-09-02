/**
 * Where an expired session goes.
 *
 * ADR-008 §91: 401 is *always* an expired/absent SSO token, never a permission
 * verdict. `proxy.ts` only gates on the cookie's presence, so a present-but-
 * expired cookie walks past it and every BFF call answers 401 — and until
 * something turns that into a login, the reader gets an error card for a
 * session that merely needs renewing.
 */

/**
 * basePath (`next.config.ts`). `next/link`, `router` and `redirect` add it
 * themselves; a raw `location.assign` and a literal query value do not, which is
 * the only reason this module spells it out. Do not copy it elsewhere.
 */
const BASE_PATH = '/pass';

/**
 * Login entry the SSO gate uses (`proxy.ts`, `app/sso/login/route.ts`).
 *
 * The returned path is basePath-relative — for callers that get the prefix for
 * free. `returnTo` is the exception: it travels as a literal query value the BFF
 * echoes back as the post-login `Location`, so it must already carry `/pass` or
 * the return trip lands on a 404. `app/sso/login/route.ts` drops any value that
 * does not start with the prefix.
 */
export const ssoLoginPath = (returnTo: string) =>
  `/sso/login?returnTo=${encodeURIComponent(returnTo)}`;

/**
 * Client-side: hand the browser to SSO so it comes back to the page it was on.
 *
 * `location.pathname` is the raw URL, so it already carries `/pass` — and
 * `assign` is not basePath-aware, so the destination needs the prefix spelled.
 */
export const redirectToSsoLogin = (): void => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${BASE_PATH}${ssoLoginPath(returnTo)}`);
};

/**
 * Request header `proxy.ts` sets on every pass-through: the path being served,
 * already in `returnTo` shape (`/pass`-prefixed, query included).
 *
 * A server component cannot read the request URL, so this is the only way a 401
 * caught mid-render knows which page to come back to (`lib/bff/session-expired.ts`).
 * It is proxy-owned: an inbound value is overwritten, never trusted.
 */
export const PATHNAME_HEADER = 'x-pathname';
