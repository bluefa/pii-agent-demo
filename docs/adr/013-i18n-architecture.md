# ADR-013: Internationalization Architecture (Cookie + Full Reload + Layered Translation Contract)

## Status

Proposed · 2026-04-27

**Amends:** [ADR-008](./008-error-handling-strategy.md) — see Decision D2 and "Relationship to other ADRs".
**Extends:** [ADR-010](./010-guide-cms-slot-registry.md) — `LocalizedGuide` DTO (D2) generalizes the `{ ko, en }` payload rule to server-generated inline guides.
**Relates to:** [ADR-011](./011-typed-bff-client-consolidation.md).

## Context

The product needs Korean (`ko`) and English (`en`) UI. Two requirements shape the design.

**R1. Locale toggling is assumed rare.** Working assumption (no telemetry yet): users pick a language at session start and rarely toggle mid-session. Under this assumption, brief context loss on toggle (re-rendering the page) is acceptable. If real usage contradicts the assumption, this ADR is the trigger for revisiting D1 (see Open issue O7).

Concrete flows that lose state on a switch under D1 (so the assumption matters):
- Candidate selection drafts — `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection.tsx:76-78`
- Approval-modal input — `app/components/features/process-status/ApprovalRequestModal.tsx:74-102`
- In-progress polling sessions — `app/hooks/usePollingBase.ts:33-38,94-103`

> An earlier draft pursued **strict R1** ("nothing other than text updates") via a pure-CSR provider swap. The team rejected that path after weighing costs: it required a permanent rule that translated text lives in client components only (D4), `codeRaw` propagation through every BFF/legacy adapter, a provider state holder, both-bundle preloading, and imperative `<html lang>` mutation. Under the assumed toggle frequency, that debt is not justified.

**R2. Internal tool, no SEO.** URLs do not gain a locale segment. Existing bookmarks must work. `assetPrefix: '/integration'` is untouched.

### Current state (main @ 9b5b6ab)

- No i18n library; `<html lang="ko">` hardcoded in `app/layout.tsx`.
- `next.config.ts` has `assetPrefix` + `output: 'standalone'`; no next-intl plugin wrapper.
- No central CSR cache. Hooks key on domain ids only — naturally locale-independent.
- `lib/fetch-json.ts:79` builds `AppError.message` from `body.detail ?? body.title ?? 'HTTP ${status}'`. Server `detail` is Korean today.
- Guide CMS (ADR-010) already serves bilingual `contents: { ko, en }` HTML and is consumed by `GuideCardContainer` via `useGuide(name)` — locale-independent at the cache level.
- BFF generates inline contextual guide prose (e.g. scan-failure remediation) **rule-based** (template + values), not via LLM. Producing both languages costs one extra template lookup per response.

### Why this needs an ADR (and a single one)

The decision combines three sub-choices that travel together: (D1) library + routing + switch mechanics, (D2) the layered translation contract by content type, (D3) lighter defensive rules. R1's relaxed reading is what licenses the simplification. Splitting into separate ADRs would let a future engineer revise one half without seeing the constraint that justified the simplification.

### Alternatives considered

**A. `[locale]` URL segment.** Rejected — R2 forbids URL change; conflicts with `assetPrefix: '/integration'`.

**B. Pure-CSR provider swap (no roundtrip).** Rejected — the prior draft of this ADR. Implementation cost (D4 RSC rule, error-taxonomy widening, provider state holder, both-bundle preload, imperative DOM) outweighs the benefit at observed toggle frequency.

**C. Cookie + `router.refresh()` (RSC restream).** Rejected — middle ground. Preserves CSR state but re-runs SSR `bff.*` calls. Provides little extra value over (D) once we've accepted that toggling is rare; introduces ambiguity about what counts as "re-fetch".

**D. Cookie + `window.location.reload()`.** Chosen. See D1.

**E. `Accept-Language` header → server returns single-locale text.** Rejected as a cross-cutting pattern. Cache contamination risk is real (BFF cache, CDN, browser HTTP cache, Next.js Route Handler `fetch` defaults — any one missing `Vary: Accept-Language` leaks the wrong locale). See D2.

**F. Two ADRs (routing vs response contract).** Rejected — see "Why this needs an ADR".

## Decision

### D1. Library + routing + switch mechanics

- **Library:** `next-intl`. `next.config.ts` is wrapped with `createNextIntlPlugin('./lib/i18n/request.ts')`. The plugin call makes the custom path explicit; the existing `assetPrefix` + `output: 'standalone'` config is preserved.
- **Routing:** `NEXT_LOCALE` cookie is the source of truth. URLs are unchanged.
- **SSR locale resolution:** `lib/i18n/request.ts` reads the cookie via `getRequestConfig`, falls back to `Accept-Language`, then `DEFAULT_LOCALE = 'ko'`.
- **Layout:** `app/layout.tsx` renders `<html lang={await getLocale()}>` and wraps children with `NextIntlClientProvider`. Translated text is allowed in both RSC (`getTranslations`) and client (`useTranslations`) components — full reload re-renders both.
- **Switch mechanics:** `LanguageSwitcher` writes the cookie and calls `window.location.reload()`. No `router.refresh()`, no provider state holder, no imperative DOM mutation.

```ts
// LanguageSwitcher (essence)
const change = (next: Locale) => {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
};
```

We accept the consequence: full reload loses CSR-only state (open modals, scroll position, in-progress polling sessions, unsaved form input). R1 licenses this.

### D2. Layered translation contract — choose by content type

**Single principle:**

> Translatable prose is either **embedded as `{ ko, en }` in the response payload (server owns)** or **resolved on the client via `code → t(key)` mapping (client owns)**. `Accept-Language`-driven single-locale responses are not used in this system.

The principle yields different shapes for different content types:

| Content type | Wire shape | Owner | Rationale |
|---|---|---|---|
| Editable long-form content (Guide CMS) | `contents: { ko, en }` HTML | Server (DB-stored) | ADR-010 — admin editor must see both for parity |
| **API-inline dynamic guide (rule-based generation)** | **`LocalizedGuide` DTO (see below)** | **Server (rule-templated)** | **New decision** — rule-based generation makes 2× output cost negligible; cache-safe; covers the four shapes that exist today |
| Errors / Validation | `code` + `params` (required when the i18n template has placeholders) | Client maps via `t(\`errors.${code.toLowerCase()}\`, params)` | Smallest payload; cache-key clean; aligns with ADR-008 code-first branching |
| Enum labels (process status, role, region, provider) | English code (already the case) | Client maps via `t()` | Existing pattern in `lib/constants/labels.ts` and friends |
| Dates / numbers / file sizes | ISO 8601 / raw value (already the case) | Client `Intl.DateTimeFormat` / `Intl.NumberFormat` at render | Locale-independent payload |
| User-input data (resource names, descriptions) | as-is | not translated | not in scope |

**`LocalizedGuide` DTO — normalized bilingual shape.** Today the codebase has four single-locale guide shapes: a freeform string at `lib/bff/types/gcp.ts:18-21`, a freeform string at `app/lib/api/index.ts:564-570` (mirrored in `docs/swagger/test-connection.yaml:296-299`), a structured `ApiGuide { title, steps, documentUrl }` at `lib/types.ts:511-522`, and a `{ description, documentUrl }` object at `lib/types/azure.ts:104-107`. We normalize all four into one DTO so renderers and BFF templates stay symmetric:

```ts
// lib/types/i18n.ts (new)
export interface GuideBody {
  title?: string;
  description?: string;          // freeform prose; replaces the bare `string` shapes
  steps?: string[];
  documentUrl?: string;          // locale-shared; same value may appear in both
}
export interface LocalizedGuide {
  ko: GuideBody;
  en: GuideBody;
}
```

Migration targets (must adopt `LocalizedGuide`): `lib/bff/types/gcp.ts:18-21` (`guide?: string | null`), `app/lib/api/index.ts:564-570` + `docs/swagger/test-connection.yaml:296-299` (test-connection `guide`), `lib/types.ts:511-522` (`ApiGuide` → becomes `GuideBody`, response field becomes `LocalizedGuide`), `lib/types/azure.ts:104-107` (`{ description, documentUrl }`). Mocks: `lib/mock-gcp.ts:81-90`, `lib/mock-azure.ts:343-347`, `lib/mock-service-settings.ts:18-64`. Migration is BFF-coordinated and shippable independently per endpoint; the FE renderer will accept legacy single-locale shapes during the transition (treats them as `{ ko: <body>, en: <body> }` so unmigrated endpoints stay readable).

**Why no `Accept-Language`.** Today's request path (`browser → Next route → BFF`, `lib/bff/http.ts:33-40` plain `fetch` with no cache option, Next default "auto no cache" for server fetch) does not have a contamination incident waiting to happen. The rule is a **forward guard**: as soon as anyone adds explicit `cache: 'force-cache'`, a CDN, or a BFF response cache, every layer must `Vary: Accept-Language` to stay correct. One missed `Vary` would leak wrong-locale prose with sporadic, hard-to-trace symptoms. Adopting `LocalizedGuide` + `code → t()` instead of `Accept-Language` removes that future risk class structurally.

**ADR-008 amendment (binding).** The Layer 1 / Layer 2 split (normalize → branch on `code`) and the `AppError` shape are unchanged. The amendment binds three points:

1. **`AppError.message` and server `detail` are diagnostics-only.** They must not be rendered as user-facing text. Components render `t(\`errors.${code.toLowerCase()}\`, params)` instead.
2. **`AppError.isUserFacing` (`lib/errors.ts:79-82`) is deprecated** because it currently treats server `detail` as safe to render — incompatible with point 1. Removal/redefinition tracked as a follow-up cleanup; until then, no new caller should rely on it.
3. **Client `AppErrorCode` taxonomy is not widened.** Codes that fall through `isKnownErrorCode` map to `errors.unknown`. The `rawDetail` (from server `detail`) is exposed on `AppError` for **dev-only fallback rendering** when the active `errors.<code>` template is missing or unparameterized; production renders the localized fallback.

**BFF coordination.** D2 introduces two requests to the BFF team:

1. **Required when interpolation is needed:** add `params: Record<string, string | number>` to `ProblemDetails` for any error code whose i18n template has placeholders (`SCAN_TOO_RECENT { minutes }`, `RATE_LIMITED { retryAfter }`, etc.). Without `params`, those codes silently degrade to `errors.unknown` — that is a contract gap, not an acceptable steady state. Codes without placeholders may omit `params`.
2. **For inline rule-based guides, return `LocalizedGuide`** (see DTO above) instead of single-locale text. Independently shippable per endpoint.

Mock handlers (`lib/bff/mock/**`, per ADR-011) follow the same shapes. Existing mocks at `lib/mock-gcp.ts:81-90`, `lib/mock-azure.ts:343-347`, `lib/mock-service-settings.ts:18-64` migrate alongside their endpoint.

### D3. Defensive rules (lighter)

- **Hooks should not include `locale` in cache keys, dependency arrays, or fetch signals.** With reload-based switching this is no longer load-bearing for "no re-fetch" — but it still prevents wasteful effect re-runs after a same-locale cookie write and clarifies that locale is not a data dimension.
- **No `Accept-Language` in any FE → BFF request.** Reviewers reject any addition. Mock handlers do not branch on it either.

## Consequences

### Positive

- **Implementation matches the next-intl default example.** ~5-line `LanguageSwitcher`. No provider state holder, no imperative DOM, no preload of both bundles.
- **BFF burden is minimal and non-blocking.** Two additive changes (`params` field, `{ ko, en }` for inline guides) — both can ship after FE.
- **No D4 (RSC text rule).** Existing RSC text (e.g. `app/integration/target-sources/[targetSourceId]/page.tsx:14`) does not need a refactor before i18n ships.
- **No client error-taxonomy widening.** No `codeRaw`, no `interpolation` passthrough through `BffErrorBody`, `extractBffError`, `transformLegacyError`. ADR-008's existing types stay.
- **Removes a future cache-contamination class.** Eliminating `Accept-Language` from FE→BFF requests means we never need to police `Vary: Accept-Language` at every cache layer that gets added later.
- **Conditionally reversible.** If toggle frequency rises and CSR-state preservation becomes valuable, switching from D1's `window.location.reload()` to a pure-CSR swap is **not free**: any RSC that renders translated prose under D1 (e.g. `app/integration/target-sources/[targetSourceId]/page.tsx:13-14`) would freeze in the SSR-time locale after a CSR-only swap. Reversal therefore requires either (a) accepting `router.refresh()` (RSC restream + SSR data re-fetch), or (b) reintroducing a D4-style rule that bans translated prose in RSCs and migrating those callsites. D2/D3 stay valid in either reversal path.

### Negative / cost

- **Full reload loses CSR state on switch.** Open modals, scroll position, in-progress polling sessions, unsaved form input — see "Concrete flows" in Context for the cited callsites. Accepted under R1's assumed toggle frequency (O7).
- **Migration sweep for Korean string literals is unchanged in scope.** Whichever approach we pick, every JSX literal, `aria-label`, `placeholder`, `alert()`, `toast.error` fallback, and `Record<Enum, string>` label map must move to `messages/*.json`. The plan (`docs/reports/i18n-support-plan.md`) owns the migration matrix.
- **Both message bundles are not preloaded.** A locale switch fetches the new locale's messages on the next page load. This is fine on reload; we do not promise instant in-page swap.
- **BFF asks (D2).** The `params` field and `{ ko, en }` inline guide shape need BFF team agreement. Both are additive and independently shippable.

### Open issues

| # | Issue | Decision needed by | Default if undecided |
|---|---|---|---|
| O3 | BFF adds `params` field for ICU interpolation (required for parameterized error codes) | BFF team + FE | Until the field exists, parameterized error codes degrade to `errors.unknown` — treat as a contract gap, not a steady state |
| O5 | Per-user locale persistence (cookie → user profile DB) | PO + Backend | Cookie only; revisit on multi-device sync request |
| O7 | Validate the R1 toggle-frequency assumption | PO + FE telemetry | Ship under the assumption; instrument LanguageSwitcher to count clicks; revisit D1 if observed rate exceeds an agreed threshold |
| O8 | `LocalizedGuide` migration order across the four legacy guide shapes | BFF team + FE | FE renderer accepts both shapes during transition; BFF migrates per endpoint |

## Relationship to other ADRs

- **ADR-008 (CSR error handling):** Binding amendment (D2). `AppError.message` and server `detail` become diagnostics-only; `AppError.isUserFacing` is deprecated; user-facing rendering goes through `t(\`errors.${code}\`)`. Layer 1 / Layer 2 split, code-based branching, and the `AppError` shape stay. ADR-008 receives an "Amendment 2026-04 — see ADR-013" block pointing here (this PR).
- **ADR-010 (Guide CMS Slot Registry):** Extended — `GuideCardContainer.lang` will call `useLocale()` and pass the result; `useGuide(name)` already returns both languages and does not key on locale. The same `{ ko, en }` payload rule now also applies to server-generated inline guide prose (D2).
- **ADR-011 (Typed BFF Client Consolidation):** No conflict. Typed clients carry `code` already; `params` is additive to error response shapes.

## Implementation roadmap

Phased plan, file lists, and migration matrix live in `docs/reports/i18n-support-plan.md`. **This ADR does not duplicate the plan.** The plan needs slimming to reflect this ADR — most of its strict-R1-era content (Phase 2-E for `process-guides.ts`, the `codeRaw`/`messageKey` contract changes, lint rule for hook locale deps as a blocker) is no longer load-bearing. Trim is tracked separately.

## Affected files (decision boundary)

- `next.config.ts` — wrap with `createNextIntlPlugin('./lib/i18n/request.ts')`
- `package.json` + lockfile — add `next-intl`
- `app/layout.tsx` — `<html lang={await getLocale()}>`, `NextIntlClientProvider`
- `app/components/ui/LanguageSwitcher.tsx` — new, cookie write + `window.location.reload()`
- `app/components/features/process-status/GuideCard/GuideCardContainer.tsx` — implementation change: call `useLocale()`, pass as `lang`
- New: `lib/i18n/{config,request,format}.ts`, `lib/types/i18n.ts` (`GuideBody`, `LocalizedGuide`), `messages/{ko,en}/*.json`
- `lib/errors.ts` — deprecate `isUserFacing`; document `rawDetail` as dev-only fallback
- `lib/bff/types/gcp.ts`, `lib/types.ts` (`ApiGuide`), `lib/types/azure.ts`, `app/lib/api/index.ts`, `docs/swagger/test-connection.yaml` — migrate guide fields to `LocalizedGuide` (per-endpoint, BFF-coordinated)
- `lib/bff/mock/**` and `lib/mock-{gcp,azure,service-settings}.ts` — mock-side migration alongside endpoints
- `app/api/_lib/problem.ts` — accept `params` field on `ProblemDetails`
- Components currently rendering Korean literals — domain-by-domain PRs governed by the implementation plan
- `docs/adr/008-error-handling-strategy.md` — Amendment block pointing to this ADR
- `docs/adr/README.md` — index entry for ADR-013
