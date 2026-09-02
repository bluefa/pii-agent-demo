/**
 * Turn a BFF 401 caught on the server into the SSO login, mid-render.
 *
 * ADR-008 §91: 401 is *always* an expired/absent SSO session, never a permission
 * verdict. `proxy.ts` gates on the cookie's presence only, so an expired-but-
 * present cookie walks past it — and on a client-side (soft) navigation the
 * layout does not re-run and no browser fetch happens, so the server component
 * that made the call is the only place left to notice. Its own catch would paint
 * "조회 실패" for a session that merely needs renewing.
 *
 * ⛔ Call this from the catch **body**, never from inside another `try`.
 * `redirect()` navigates by throwing, so a wrapping try swallows the navigation
 * and turns it back into a failed fetch (same reason as the note in
 * `app/admin/layout.tsx`).
 *
 * The path comes from the header `proxy.ts` sets, so it already carries the
 * `/pass` basePath that `returnTo` needs; `app/sso/login/route.ts` re-validates
 * that prefix before handing the value to the BFF.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { BffError } from '@/lib/bff/errors';
import { passRoutes } from '@/lib/routes';
import { PATHNAME_HEADER, ssoLoginPath } from '@/lib/sso-login';

/** Anything that is not a 401 returns, so the caller's own failure copy stands. */
export async function redirectIfSessionExpired(err: unknown): Promise<void> {
  if (!(err instanceof BffError) || err.status !== 401) return;

  // No header means the proxy did not run for this request (matcher exclusion,
  // direct render). The console dashboard is the fallback because `/admin` has
  // no page of its own — returning there would 404 right after logging in.
  const path = (await headers()).get(PATHNAME_HEADER);
  redirect(ssoLoginPath(path ?? `/pass${passRoutes.pipelines.dashboard}`));
}
