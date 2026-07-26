/**
 * Auth credential passthrough (IAP / SSO).
 *
 * The frontend runs behind two different auth layers (GCP IAP and SSO) and
 * must not care which one it sits behind: it never validates credentials,
 * it only forwards them losslessly to the BFF, which owns validation
 * (ADR-008: 401 always means SSO token expired / unauthenticated).
 *
 * Next.js `headers()` is AsyncLocalStorage-backed, so this works from any
 * server code inside a request scope (route handlers AND server components)
 * without threading the request through ~90 bff.* call sites.
 */
import { headers } from 'next/headers';

// Allowlist only — never forward arbitrary inbound headers to the BFF.
const FORWARDED_AUTH_HEADERS = [
  'authorization',
  'cookie',
  'x-goog-iap-jwt-assertion',
  'x-goog-authenticated-user-email',
  'x-goog-authenticated-user-id',
] as const;

export async function authHeaders(): Promise<Record<string, string>> {
  let inbound: Awaited<ReturnType<typeof headers>>;
  try {
    inbound = await headers();
  } catch {
    // Outside a request scope (build-time prerender, tests) — nothing to forward.
    return {};
  }
  const forwarded: Record<string, string> = {};
  for (const name of FORWARDED_AUTH_HEADERS) {
    const value = inbound.get(name);
    if (value) forwarded[name] = value;
  }
  return forwarded;
}
