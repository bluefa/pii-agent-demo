# API Boundaries

The app has **two parallel data-fetching pipelines**. They look similar but serve different execution contexts. Mixing them is a recurring source of confusion; this document is the single source of truth for "which import lives where."

## TL;DR

```
┌─────────────────────────────────────────────────────────────────────┐
│ Where code runs      │ Uses                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Browser (CSR)        │ @/app/lib/api/*        ← hop 1: Next route    │
│ Server Component     │ @/lib/bff/*            ← direct, no HTTP hop  │
│ Next.js Route        │ @/lib/api-client/*     ← dispatches to BFF    │
└─────────────────────────────────────────────────────────────────────┘
```

**Rule:** never import across boundaries. A component doesn't reach into `lib/api-client`; a route handler doesn't call `app/lib/api/*`.

---

## Pipeline 1 — CSR (client-side rendering)

This is the default for interactive pages under `app/integration/target-sources/**`, `app/components/**`.

```
┌──────────────┐   fetch      ┌───────────────────┐   dispatch   ┌──────────────┐    HTTP     ┌──────────────┐
│ React client │ ───────────▶ │ Next Route        │ ───────────▶ │ api-client   │ ──────────▶ │ Upstream BFF │
│ component    │  /integration│ /v1/*/route.ts    │   client.x.y │ (bff-client  │  ${BFF_URL} │              │
│              │  /api/v1/... │                   │              │  or mock)    │  /install/v1│              │
└──────────────┘              └───────────────────┘              └──────────────┘             └──────────────┘
      │                              │                                   │
      │   @/app/lib/api/*            │   @/app/api/_lib/handler          │   @/lib/api-client
      │   fetchInfra*()              │   withV1(client.xxx.yyy)          │   client: ApiClient
```

### Module layout

| Layer | Path | Role | Who can import |
|-------|------|------|----------------|
| Component DAL | `@/app/lib/api/*.ts` | `fetchInfraJson('/aws/...')` helpers — one file per domain | **CSR components only** |
| Transport | `@/app/lib/api/infra.ts` | `fetchInfraCamelJson`, `fetchInfraJson`, `parseInfraCamelJson` | `@/app/lib/api/*` |
| Prefix constants | `@/lib/infra-api.ts` | `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'` | anywhere |
| Route handler | `@/app/integration/api/v1/**/route.ts` | `export const GET = withV1(req => client.x.y(...))` | Next runtime |
| Dispatcher | `@/lib/api-client/index.ts` | `IS_MOCK ? mockClient : bffClient` | route handlers only |
| Real impl | `@/lib/api-client/bff-client.ts` | Proxies to `${BFF_URL}/install/v1/...` | dispatcher only |
| Mock impl | `@/lib/api-client/mock/*.ts` | In-memory fake implementations | dispatcher only |
| Error normalization | `@/lib/fetch-json.ts` + `@/lib/errors.ts` | Throws `AppError` | anywhere on CSR |

### Request flow

1. Component calls `getAwsSettings(42)` from `@/app/lib/api/aws.ts`
2. That helper calls `fetchInfraCamelJson('/aws/target-sources/42/settings')`
3. `fetchInfraCamelJson` prepends `INTERNAL_INFRA_API_PREFIX` → `/integration/api/v1/aws/target-sources/42/settings`
4. Browser issues `fetch('/integration/api/v1/...')` — **visible in Network tab** (hop 1)
5. Next route handler at `app/integration/api/v1/aws/target-sources/[id]/settings/route.ts` dispatches to `client.aws.getSettings(42)`
6. `client` is `bffClient` (or `mockClient` when `USE_MOCK_DATA=true`)
7. `bffClient.aws.getSettings(42)` → `fetch('${BFF_URL}/install/v1/aws/target-sources/42/settings')` — **hop 2, server-to-server, NOT in browser Network tab**

### Why two hops?

Hop 1 exists because the app is mounted under `/integration` (`next.config.ts` assetPrefix). Hop 2 is the actual BFF call; the Next route handler is a thin proxy that:

- Swaps the prefix (`/integration/api/v1` → `/install/v1`)
- Handles auth cookies server-side
- Applies `camelCaseKeys` on the response
- Switches between mock and real via `USE_MOCK_DATA`

---

## Pipeline 2 — SSR (Server Component)

Used only by React Server Components (currently `app/integration/target-sources/[targetSourceId]/page.tsx`).

```
┌──────────────────┐   function call   ┌────────────────────────┐    HTTP     ┌──────────────┐
│ Server Component │ ────────────────▶ │ lib/bff/client.ts      │ ──────────▶ │ Upstream BFF │
│ (RSC)            │                   │ (server-only)          │  ${BFF_URL} │              │
└──────────────────┘                   │ → httpBff or mockBff   │             └──────────────┘
                                       └────────────────────────┘
```

### Module layout

| Layer | Path | Role | Who can import |
|-------|------|------|----------------|
| Public surface | `@/lib/bff/client.ts` | Marked `'server-only'`. Exports `bff: BffClient` | **Server Components only** |
| Types | `@/lib/bff/types.ts` | `BffClient` contract | Server Components, implementations |
| Real impl | `@/lib/bff/http.ts` | HTTP to `${BFF_URL}` | `lib/bff/client.ts` only |
| Mock impl | `@/lib/bff/mock-adapter.ts` | Local fake | `lib/bff/client.ts` only |
| Errors | `@/lib/bff/errors.ts` | `BffError` | `lib/bff/*` |

### Why a second client?

Server Components can't go through a Next route handler (they'd hit their own server over HTTP). `lib/bff/*` makes one direct hop to the upstream.

### Marker

`lib/bff/client.ts` starts with `import 'server-only'` — importing it from a client component fails the build. This is the primary guard.

---

## Which pipeline should I use?

```
Is the file marked "use client" or does it render interactivity? ──▶ Pipeline 1 (CSR)
Is it a plain async function in app/ that returns JSX?           ──▶ Pipeline 2 (SSR)
Is it a file under app/integration/api/v1/**/route.ts?           ──▶ Route handler — use @/lib/api-client
```

## Forbidden imports

| From | Must NOT import |
|------|-----------------|
| `app/components/**`, `app/integration/target-sources/**` (CSR) | `@/lib/api-client/*`, `@/lib/bff/*` |
| `app/integration/target-sources/[targetSourceId]/page.tsx` (Server Component) | `@/app/lib/api/*`, `@/lib/api-client/*` |
| `app/integration/api/v1/**/route.ts` (route handler) | `@/app/lib/api/*`, `@/lib/bff/*` |
| `lib/api-client/*` | `@/app/lib/api/*` |
| `lib/bff/*` | `@/app/lib/api/*`, `@/lib/api-client/*` |

### How to enforce

Proposed `eslint.config.mjs` rule (not yet added):

```js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/lib/api-client/*', '@/lib/bff/*'],
          message: 'Client components must use @/app/lib/api/* — see docs/api/boundaries.md',
        },
      ],
    }],
  },
  // Scope to client-component directories only.
}
```

---

## Naming conventions

The two pipelines share suffixes, which is part of why this is confusing. Stick to these names:

| Concept | Pipeline 1 (CSR) | Pipeline 2 (SSR) |
|---------|------------------|------------------|
| Public entry | `client` (from `@/lib/api-client`) | `bff` (from `@/lib/bff/client`) |
| Type | `ApiClient` | `BffClient` |
| Real impl | `bffClient` | `httpBff` |
| Mock impl | `mockClient` | `mockBff` |
| Caller helper | `fetchInfra*` in `app/lib/api/*` | direct call to `bff.xxx.yyy()` |

> Yes, `bffClient` lives in Pipeline 1 and `bff` lives in Pipeline 2. This is historical. If renames happen, update both pipelines at once — do not fold one into the other without a migration plan (they serve different execution contexts).

---

## Related docs

- [ADR-007 — API Client Pattern](../adr/007-api-client-pattern.md)
- [ADR-008 — Error Handling Strategy](../adr/008-error-handling-strategy.md)
- `.claude/skills/anti-patterns/SKILL.md` — the "API boundary anti-patterns" section
- Session memory: "BFF 2-hop architecture"

## Open questions (future work)

- **`lib/bff/*` vs `lib/api-client/bff-client.ts`** — two HTTP clients targeting the same upstream. Possible consolidation: have `httpBff` reuse `bff-client` transport (needs design review).
- **Schema validation** — both pipelines currently `as`-cast responses. Adding zod at the route-handler / `bff` boundary would close the type-safety gap (see anti-pattern A2, A3).
- **ESLint `no-restricted-imports`** — not yet enforced; relying on convention today.
