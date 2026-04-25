# API Boundaries

The app has **one typed data-access layer** (`@/lib/bff/*`) consumed via two execution contexts. ADR-011 consolidated the previous two-client architecture; this document is the single source of truth for "which import lives where."

## TL;DR

```
┌─────────────────────────────────────────────────────────────────────┐
│ Where code runs      │ Uses                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Browser (CSR)        │ @/app/lib/api/*       ← hop 1: Next route    │
│ Server Component     │ @/lib/bff/client      ← direct, typed         │
│ Next.js Route        │ @/lib/bff/client      ← typed dispatch        │
└─────────────────────────────────────────────────────────────────────┘
```

**Rule:** never import across boundaries. A CSR component does not reach into `@/lib/bff/*`; a route handler does not call `@/app/lib/api/*`.

---

## Pipeline 1 — CSR (client-side rendering)

This is the default for interactive pages under `app/integration/**/_components/**`, `app/components/**`.

```
┌──────────────┐   fetch      ┌───────────────────┐   typed       ┌──────────────┐    HTTP     ┌──────────────┐
│ React client │ ───────────▶ │ Next Route        │ ───────────▶  │ lib/bff      │ ──────────▶ │ Upstream BFF │
│ component    │  /integration│ /v1/*/route.ts    │   bff.x.y     │ (httpBff or  │  ${BFF_URL} │              │
│              │  /api/v1/... │   withV1(...)     │               │  mockBff)    │  /install/v1│              │
└──────────────┘              └───────────────────┘               └──────────────┘             └──────────────┘
      │                              │                                   │
      │   @/app/lib/api/*            │   @/app/api/_lib/handler          │   @/lib/bff/client
      │   fetchInfra*()              │   withV1(bff.xxx.yyy)             │   bff: BffClient
```

### Module layout

| Layer | Path | Role | Who can import |
|-------|------|------|----------------|
| Component DAL | `@/app/lib/api/*.ts` | `fetchInfraJson('/aws/...')` helpers — one file per domain | **CSR components only** |
| Transport | `@/app/lib/api/infra.ts` | `fetchInfraCamelJson`, `fetchInfraJson`, `parseInfraCamelJson` | `@/app/lib/api/*` |
| Prefix constants | `@/lib/infra-api.ts` | `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'` | anywhere |
| Route handler | `@/app/integration/api/v1/**/route.ts` | `export const GET = withV1(req => bff.x.y(...))` | Next runtime |
| BFF dispatcher | `@/lib/bff/client.ts` | `IS_MOCK ? mockBff : httpBff` | route handlers + Server Components |
| Real impl | `@/lib/bff/http.ts` | Proxies to `${BFF_URL}/install/v1/...` | dispatcher only |
| Mock impl | `@/lib/bff/mock-adapter.ts` + `@/lib/bff/mock/*` | In-memory fake implementations | dispatcher only |
| Errors | `@/lib/bff/errors.ts` | `BffError` (route layer maps to ProblemDetails via `withV1`) | `lib/bff/*`, route handlers |

### Request flow

1. Component calls `getAwsSettings(42)` from `@/app/lib/api/aws.ts`
2. That helper calls `fetchInfraCamelJson('/aws/target-sources/42/settings')`
3. `fetchInfraCamelJson` prepends `INTERNAL_INFRA_API_PREFIX` → `/integration/api/v1/aws/target-sources/42/settings`
4. Browser issues `fetch('/integration/api/v1/...')` — **visible in Network tab** (hop 1)
5. Next route handler dispatches to `bff.aws.getSettings(42)`
6. `bff` is `httpBff` (or `mockBff` when `USE_MOCK_DATA=true`)
7. `httpBff.aws.getSettings(42)` → `fetch('${BFF_URL}/install/v1/aws/target-sources/42/settings')` — **hop 2, server-to-server, NOT in browser Network tab**

### Why two hops?

Hop 1 exists because the app is mounted under `/integration` (`next.config.ts` assetPrefix). Hop 2 is the actual BFF call; the Next route handler is a thin proxy that:

- Swaps the prefix (`/integration/api/v1` → `/install/v1`) via `httpBff`
- Handles auth cookies server-side
- Switches between mock and real via `USE_MOCK_DATA` (selected once in `lib/bff/client.ts`)

---

## Pipeline 2 — SSR (Server Component)

Used by React Server Components (e.g. `app/integration/target-sources/[targetSourceId]/page.tsx`).

```
┌──────────────────┐   function call   ┌────────────────────────┐    HTTP     ┌──────────────┐
│ Server Component │ ────────────────▶ │ lib/bff/client.ts      │ ──────────▶ │ Upstream BFF │
│ (RSC)            │                   │ (server-only)          │  ${BFF_URL} │              │
└──────────────────┘                   │ → httpBff or mockBff   │             └──────────────┘
                                       └────────────────────────┘
```

Server Components and route handlers share the same `bff` import. There is no second client.

### Marker

`lib/bff/client.ts` starts with `import 'server-only'` — importing it from a CSR component fails the build. This is the primary guard, supplemented by ESLint `no-restricted-imports`.

---

## Which pipeline should I use?

```
Is the file marked "use client" or under app/**/_components/?           ──▶ Pipeline 1 (CSR)
Is it a plain async function in app/ that returns JSX?                  ──▶ Pipeline 2 (SSR)
Is it a file under app/integration/api/v1/**/route.ts?                  ──▶ Route handler — use @/lib/bff/client
```

## Forbidden imports

| From | Must NOT import |
|------|-----------------|
| `app/components/**` (CSR) | `@/lib/bff/*` (use `@/app/lib/api/*`) |
| `app/integration/**/_components/**` (CSR) | `@/lib/bff/*` (use `@/app/lib/api/*`) |
| Server Components | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| `app/integration/api/v1/**/route.ts` | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| Anywhere | `@/lib/api-client/*` (deleted in ADR-011) |

### Enforcement

`eslint.config.mjs` enforces these via `no-restricted-imports`:

- Project-wide ban on `@/lib/api-client` and `@/lib/api-client/*`
- CSR scopes (`app/components/**`, `app/integration/**/_components/**`) banned from `@/lib/bff/*`
- Route handlers (`app/integration/api/v1/**/route.ts`) banned from `@/app/lib/api/*`

The `'server-only'` directive in `lib/bff/client.ts` provides a second runtime guard.

---

## Naming conventions

| Concept | Pipeline 1 (CSR) | Pipelines 2 / Route (BFF) |
|---------|------------------|---------------------------|
| Public entry | helper functions in `@/app/lib/api/*` | `bff` (from `@/lib/bff/client`) |
| Type | inferred from helper return | `BffClient` |
| Real impl | n/a (helpers wrap `fetch`) | `httpBff` |
| Mock impl | n/a (mock lives behind the route) | `mockBff` |

---

## Related docs

- [ADR-011 — Typed BFF Client Consolidation](../adr/011-typed-bff-client-consolidation.md)
- [ADR-008 — Error Handling Strategy](../adr/008-error-handling-strategy.md)
- `.claude/skills/anti-patterns/SKILL.md` — "API boundary anti-patterns" section
- Session memory: "BFF 2-hop architecture"

## Resolved by ADR-011

The previous "Open questions" — two HTTP clients, schema validation gap framed against the boundary, ESLint enforcement — were addressed by ADR-011 over specs adr011-01 through adr011-05. Schema validation at routes (zod) is tracked separately as a future ADR.
