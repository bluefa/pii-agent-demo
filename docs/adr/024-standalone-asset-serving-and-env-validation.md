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
- The `/integration` URL prefix exists **only** because every page is physically
  nested under `app/integration/**` (289 files). It was an arbitrary internal
  choice, not an external contract.

The recommended textbook fix is `basePath: '/integration'`, which makes the
server serve routes *and* assets under the prefix. But `basePath` stacks on top
of the folder nesting, yielding `/integration/integration/*` — so adopting it
forces un-nesting all 289 files and rewriting ~333 hardcoded `/integration`
references. That is a large, high-regression refactor for a prefix that carries
no external meaning.

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

### LIN-56 — drop `assetPrefix`, keep folder nesting

Remove `assetPrefix` entirely. Pages stay at `/integration/*` via folder nesting;
the server serves assets at `/_next/*`. The image is then **self-consistent**:
`docker run` with no proxy loads styles and JS correctly.

`basePath` + un-nesting is explicitly **rejected** — disproportionate risk for an
arbitrary prefix.

**Deployment contract (must hold):** the LB chain (ELB → ILB → server) must
forward **both** `/integration/*` (pages) and `/_next/*` (assets) to this
service. Do **not** path-isolate `/integration/*` and drop the rest. Because the
prefix is arbitrary, the natural "forward everything to the single frontend
service" topology already satisfies this. If a future ingress must strictly
isolate `/integration/*`, revisit and adopt `basePath` + un-nest at that point.

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

- `docker run <image>` (no proxy) serves a fully styled, interactive app.
- Booting real mode without `BFF_API_URL` fails immediately with a clear error
  instead of silently 500-ing per request.
- `USE_MOCK_DATA` unset ⇒ real everywhere, pinned by tests.
- A production **server** with `USE_MOCK_DATA=true` refuses to boot; a production
  build with it only warns (so local/pre-commit builds with a mock `.env.local`
  still succeed — the image itself is always built in real mode).
- **New operational requirement:** the LB chain must route `/_next/*` to this
  service. This is the one thing to verify before the first production deploy.
- `.env.example` documents the required variables.

## Related Files

- `next.config.ts` — removed `assetPrefix`; imports `assertBuildEnv`
- `lib/env.ts` — new; zod schema + `isMock`/`assertBuildEnv`/`assertRuntimeEnv`
- `instrumentation.ts` — new; boot-time `assertRuntimeEnv`
- `lib/bff/client.ts`, `app/api/_lib/target-source.ts` — use `isMock()`
- `.env.example` — new
- `lib/__tests__/env.test.ts`, `app/api/_lib/__tests__/target-source.test.ts`
