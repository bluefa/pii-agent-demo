import { NextResponse } from 'next/server';
import { authHeaders } from '@/lib/bff/auth-headers';
import { getMeOrNull } from '@/lib/bff/current-user';
import { isAdminRole } from '@/lib/roles';

/**
 * Admin-only passthrough that serves the BFF's own springdoc Swagger UI from
 * inside this app, so an admin can read the live upstream contract without the
 * BFF being reachable from a browser.
 *
 * The gate lives in this handler, not in `app/admin/layout.tsx`: route handlers
 * do not run layouts, so the section gate does not cover this path.
 */

/** Where the proxied assets live in this app — `basePath` (`/pass`) included. */
const BASE = '/pass/admin/bff-swagger';

/**
 * Allowlist, not a `!==` test: everything under the BFF root would otherwise be
 * reachable through an admin-authenticated tunnel (`actuator`, internal APIs).
 * These two are all springdoc needs — the UI bundle and the spec/config it reads.
 */
const ALLOWED = new Set(['swagger-ui', 'v3']);

/** The BFF mounts its API under `/install`. This is where we fetch FROM, not a rewrite rule. */
const UPSTREAM_BASE_PATH = '/install';

/**
 * The only absolute urls springdoc emits: `configUrl` in `index.html`, and every
 * `urls[].url` inside `swagger-config`. They point at `/install/v3/api-docs…` on
 * this origin, which 404s under the `/pass` basePath, so they are re-pointed at
 * the proxy.
 *
 * Deliberately narrower than the bare `/install/` prefix: the OpenAPI document
 * being served has 81 path keys of its own that start with `/install/v1/…`, and
 * rewriting those would make Swagger UI display endpoint paths that do not
 * exist — corrupting the very contract this page exists to read. Relative assets
 * (`./swagger-ui.css`) already resolve under the proxy path and are not touched.
 */
const ABSOLUTE_DOC_URL = `${UPSTREAM_BASE_PATH}/v3/api-docs`;

/** Only text payloads may be rewritten — css/png must survive byte-for-byte. */
const REWRITABLE = /html|javascript|json/;

// Per-user answer: never prerender it, or the 404 gets baked in at build time.
export const dynamic = 'force-dynamic';

/**
 * GET only, deliberately. Exporting POST/PUT/DELETE here would turn the proxy
 * into an admin-authenticated write tunnel into the BFF, and Swagger UI's
 * "Try it out" would fire real upstream writes from a docs page.
 */
export const GET = async (request: Request, { params }: { params: Promise<{ path: string[] }> }) => {
  const [me, { path }] = await Promise.all([getMeOrNull(), params]);

  // A null `me` is an unauthenticated caller or a BFF that never answered.
  // Neither is an admin, so both close before any upstream call is made.
  if (!isAdminRole(me?.role) || !ALLOWED.has(path[0])) {
    return new NextResponse(null, { status: 404 });
  }

  const { search } = new URL(request.url);
  const upstreamUrl = `${process.env.BFF_API_URL}${UPSTREAM_BASE_PATH}/${path.join('/')}${search}`;
  const upstream = await fetch(upstreamUrl, {
    headers: await authHeaders(),
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const headers = { 'content-type': contentType, 'cache-control': 'no-store' };

  if (!REWRITABLE.test(contentType)) {
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  }

  const body = (await upstream.text()).replaceAll(ABSOLUTE_DOC_URL, `${BASE}/v3/api-docs`);
  return new NextResponse(body, { status: upstream.status, headers });
};
