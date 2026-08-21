/**
 * Relays a BFF auth response (302 to ADFS or back to returnTo) to the browser.
 *
 * The SSO routes fetch the BFF directly instead of going through the typed
 * `bff.*` client (ADR-011): that client is 2xx-JSON only and cannot express
 * a 302 + Set-Cookie relay — a deliberate, narrow boundary exception.
 *
 * Only Location, Content-Type and Set-Cookie survive the hop — never the
 * upstream's hop-by-hop headers. Set-Cookie must be read via getSetCookie():
 * the callback response carries two cookies (session + temp-cookie deletion),
 * and headers.get('set-cookie') folds them into one comma-joined value,
 * which corrupts both.
 */
export function relayAuthRedirect(upstream: Response): Response {
  const headers = new Headers();
  const location = upstream.headers.get('location');
  if (location) headers.set('location', location);
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append('set-cookie', cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
