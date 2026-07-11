# ADR-024: Standalone Asset Serving + Environment Validation

## Status

Accepted — 2026-07-11 (LIN-56, LIN-60)

Part of the "프론트엔드 운영 배포 준비" (production readiness) audit. Two related
deployment-config decisions ship together because both touch `next.config.ts`
and both are about making the standalone Docker image behave correctly and
fail loudly when misconfigured.

## Context

### LIN-56 — asset 404 risk

`next.config.ts` set `assetPrefix: '/integration'` with **no** `basePath`.

- Prerendered HTML requested assets from `/integration/_next/static/*`.
- The standalone server (`node server.js`) only serves them at `/_next/static/*`
  (there is no `basePath` in `routes-manifest.json`).
- Result: without a proxy rewriting `/integration/_next/* → /_next/*`, every
  CSS/JS/font 404s and the app renders unstyled and non-interactive.
- The `/integration` URL prefix existed **only** because every page was physically
  nested under `app/integration/**` (289 files) — an implicit, folder-encoded
  prefix. The owner set `/integration` arbitrarily and wants it expressed as
  configuration, with pages, API route handlers, and assets all mounted under it
  uniformly, rather than as a physical-nesting hack that assets don't participate in.

### LIN-60 — env drift and silent failure

- `USE_MOCK_DATA` was interpreted inconsistently: `lib/bff/client.ts` used
  `=== 'true'` (unset ⇒ real, safe) while `app/api/_lib/target-source.ts` used
  `!== 'false'` (unset ⇒ **mock**, dangerous). `.env*` is excluded from the
  image, so in production the variable is unset — mixed mock/real behavior.
- `BFF_API_URL` fell back to `''`, turning server-side calls into relative-URL
  fetches that fail silently at request time instead of at boot.
- The mock layer is statically imported and selected by a runtime ternary, so a
  leaked `USE_MOCK_DATA=true` in production would serve seed data — fatal for a
  PII tool, and could bake seed into prerendered HTML at build time.

## Decision

### LIN-56 — adopt `basePath: '/integration'`, un-nest the app

Set `basePath: '/integration'` and **remove `assetPrefix`**. The standalone
server now serves routes, API route handlers, and `/_next/*` assets all under
`/integration` from configuration — no `assetPrefix` 404 trap, no proxy rewrite.
Verified end-to-end: `/integration/services` → 200, `/integration/_next/static/*.js`
→ 200, `/integration/api/v1/health` → 200, `/integration` → 307 → `/integration/services`,
and bare `/services` → 404 (the app mounts *only* under the prefix).

Because `basePath` stacks on the folder nesting (`/integration/integration/*`),
the app was **un-nested**: `app/integration/{admin,api-docs,services,swagger,
target-sources}` → `app/*` and `app/integration/api/v1` → `app/api/v1`. The bulk
of the ~330 `/integration` literals were `@/app/integration/...` import paths
rewritten mechanically to `@/app/...`.

**basePath-awareness is the rule that governs the remaining literals:**
- `next/link`, `router`, `redirect`, `usePathname` **add/strip** basePath — so
  `lib/routes.ts` and pathname comparisons are basePath-relative (no `/integration`).
- raw `fetch` and `<iframe src>` are **not** basePath-aware — so `INTERNAL_INFRA_API_PREFIX`
  (`/integration/api/v1`), the SwaggerUI spec URL, and the api-docs iframe keep the
  literal `/integration`.

**Deployment contract (simpler than before):** the LB chain (ELB → ILB → server)
routes `/integration/*` to this service, path preserved (no strip). Everything —
pages, API, assets — lives under that one prefix, so a single path rule suffices;
there is no separate `/_next/*` routing requirement.

### LIN-60 — zod env schema + build & boot gates

`lib/env.ts` owns the contract:

- `isMock()` is the single source of truth. Only the literal `'true'` is mock;
  anything else — **including unset** — is real. Both consumers call it.
- `assertBuildEnv()` runs in `next.config.ts`: validates shape and **warns** (does
  not throw) on `NODE_ENV=production` + `USE_MOCK_DATA=true`. A hard failure here
  is wrong: `next build` is *always* `NODE_ENV=production`, and the repo pre-commit
  hook builds with the developer's `.env.local` (`USE_MOCK_DATA=true` for mock dev)
  — throwing would break every mock-dev build for no real gain, since `docker build`
  excludes `.env*` and is therefore always built in real mode. It **tolerates a
  missing `BFF_API_URL`** because `next build` runs without runtime env and
  prerender must still succeed.
- `assertRuntimeEnv()` runs in `instrumentation.ts` `register()` — the only boot
  hook the standalone server actually invokes. This is the **non-bypassable**
  block: `NODE_ENV=production` here genuinely means "prod server". It hard-blocks
  prod+mock and, in real mode, **requires `BFF_API_URL`**, calling `process.exit(1)`
  on failure (a thrown error leaves the HTTP listener bound and the server broken).

No override flag for prod+mock: running mock in production is never intended.
The static mock import is left in place (removing it is a larger refactor); the
runtime prod+mock block already prevents the dangerous outcome, and the docker
image is always built in real mode regardless.

## Consequences

- `docker run <image>` (no proxy) serves a fully styled, interactive app with
  everything — pages, API, assets — under `/integration`.
- The folder tree no longer encodes the prefix; the URL prefix is one config line.
  Changing it (or removing it) is now a `next.config.ts` edit, not a 289-file move.
- Booting real mode without `BFF_API_URL` fails immediately with a clear error
  instead of silently 500-ing per request.
- `USE_MOCK_DATA` unset ⇒ real everywhere, pinned by tests.
- A production **server** with `USE_MOCK_DATA=true` refuses to boot; a production
  build with it only warns (so local/pre-commit builds with a mock `.env.local`
  still succeed — the image itself is always built in real mode).
- **Operational requirement:** the LB chain routes `/integration/*` to this
  service with the path preserved (no strip). One rule covers pages, API, and assets.
- `.env.example` documents the required variables.

## Related Files

- `next.config.ts` — `basePath: '/integration'`, no `assetPrefix`; imports `assertBuildEnv`
- `app/integration/**` → `app/**` (un-nest); `@/app/integration/*` imports → `@/app/*`
- `lib/routes.ts` — route values stripped of `/integration` (basePath-relative)
- `app/components/layout/TopNav.tsx` — `usePathname` comparisons stripped of `/integration`
- `app/swagger/**`, `app/api-docs/**` — raw fetch/iframe keep the literal `/integration`
- `lib/env.ts` — new; zod schema + `isMock`/`assertBuildEnv`/`assertRuntimeEnv`
- `instrumentation.ts` — new; boot-time `assertRuntimeEnv`
- `lib/bff/client.ts`, `app/api/_lib/target-source.ts` — use `isMock()`
- `.env.example` — new
- `lib/__tests__/env.test.ts`, `app/api/_lib/__tests__/target-source.test.ts`
