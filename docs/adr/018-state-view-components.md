# ADR-018: State-View Components (Empty / Error / Permission)

## Status

Accepted (2026-06-20). Defines the shared components that render the `empty` / `error` / `loading` / `forbidden` states named in [ADR-017](./017-frontend-component-layering.md) §3a. **Immediately normative** for those components and **compatible with the current `AsyncState` stack** — no data-fetching change is required to adopt it. Incorporates a Codex cross-review and an industry survey.

Composes with: [ADR-017](./017-frontend-component-layering.md) (state model §3a, staged error-state §3b), [ADR-008](./008-error-handling-strategy.md) (`FORBIDDEN`, writes), [ADR-013](./013-i18n-architecture.md) (i18n copy).

## Scope

- **In scope (immediately normative):** *which* components render empty/error/loading/forbidden, their props, and the consolidation of today's scattered variants — on the current stack.
- **Out of scope:** *where* read states are handled (explicit container reduction vs boundary-hoisting). Non-suspense reads follow ADR-017 §3; the boundary-hoisted target is **[ADR-020](./020-boundary-read-rendering.md)**. Writes follow ADR-017 §3.

These components are **rendering-strategy-agnostic** — the same `<EmptyState>` / `<ErrorState>` are used as an `AsyncState` if-branch today and as a boundary fallback under ADR-020 later.

## Context

ADR-017 §3a named the states a read resolves to. The components that render the non-happy ones exist today but are **scattered and inconsistent**:

| State | Existing implementations |
|-------|--------------------------|
| Empty | `features/scan/ScanEmptyState`, `features/admin/infrastructure/InfrastructureEmptyState`, + **inline** (IDC Step 1 empty block, `ui/Table.tsx`, `WaitingApprovalCard`, `LogicalDbModal`, admin lists) |
| Error | `_components/common/ErrorState`, `features/scan/ScanErrorState`, `_components/shared/async-state-views.tsx` (`ErrorRow`) |
| Loading | `_components/common/LoadingState`, `async-state-views.tsx` (`LoadingRow`) |
| Permission / Forbidden | **none** |

The raw union already exists (`_components/shared/async-state.ts`): `{ status: 'loading' } | { status: 'ready'; data } | { status: 'error'; message }`. This is a **consolidation** problem, not greenfield.

## Industry survey

- **Empty is not a fetch status** — TanStack Query v5 models `status: pending | error | success`; empty is *derived* (`success && data.length === 0`). The RemoteData union (`NotAsked | Loading | Failure | Success`) likewise has no empty. So `empty` is a **render-state**, not a same-level fetch-state. ([TanStack Queries](https://tanstack.com/query/v5/docs/react/guides/queries), [RemoteData](https://dev.to/rametta/elm-s-remote-data-type-in-javascript-1h24))
- **Forbidden is an error subtype**, not an independent status — *authenticated but not permitted* (vs 401), classified by code/status. ([HTTP 403](https://developer.mozilla.org/docs/Web/HTTP/Status/403))
- **Empty has dedicated design-system components** (Ant Design `Empty`, Polaris `EmptyState`); the determination stays app-level. ([EmptyState in React](https://dev.to/ml318097/react-create-an-emptystate-component-n7l))

## Decision

### 1. Canonical components (presentational, Layer ⑧ — domain/content props, no I/O)

- **`<EmptyState>`** — a **variant family** (`block | inline | card`) because empty *layouts* genuinely differ (a list/page block vs a small inline widget such as GuideStatus vs a card placeholder). The *determination* and *content slots* (`icon? / title? / description? / action?`) generalize; the layout does not. A trivial inline empty may also render its own markup.
- **`<ErrorState>`** — title, description, optional retry; renders `message` now / `code` → localized later (ADR-017 §3b).
- **`<LoadingState>`** — promoted from `common/LoadingState`.
- **`<PermissionState>`** — for `forbidden`; **staged** (surfaced once the coded error-state §3b Phase 2 and an auth/403 flow exist).
- All take **semantic, token-based props** (no raw values, CLAUDE.md #4); callers pass content, components own chrome.

### 2. `empty` and `forbidden` are determined, not statuses

- `empty` = a **local render check** (`success && isEmpty(data)`) — valid identically whether the container holds `AsyncState` (today) or a component reads suspense data (ADR-020).
- `forbidden` = an **error subtype** (`error.code === 'FORBIDDEN'`, Phase 2) — a pure, unit-tested `error-classify.ts` owns the decision. Until the coded error-state lands, all errors render `<ErrorState>`.

### 3. Same components, either wiring

| Wiring | How the components are used |
|--------|------------------------------|
| **Today — non-suspense (ADR-017 §3)** | the container's `AsyncState` branch renders `<LoadingState/>` / `<ErrorState/>`; a local empty check renders `<EmptyState/>` |
| **Target — suspense (ADR-020)** | the *same* components become Suspense / Error-Boundary fallbacks |

Adopting these components requires **no** data-fetching change. ADR-020 later rewires *where* they mount.

### 4. Anchor + directory

```
app/components/ui/state/
├── EmptyState.tsx       # ⑧ — variant: block | inline | card
├── ErrorState.tsx       # ⑧ — message now / code later
├── LoadingState.tsx     # ⑧ — promoted from common/LoadingState
├── PermissionState.tsx  # ⑧ — forbidden; staged
├── error-classify.ts    # Layer ⑤ pure: error → 'forbidden' | 'error' (Phase 2 keys on code); unit-tested
└── index.ts
```

Consolidates `async-state-views.tsx` (`LoadingRow`/`ErrorRow`) and the scattered Scan/Infra/common/inline variants.

### Considered and rejected

- **Per-feature state components (status quo).** Duplicates copy/tokens, drifts, leaves `forbidden` unimplemented.
- **Making `empty` / `forbidden` raw `AsyncState` statuses.** `empty` is a render, `forbidden` an error subtype — neither is a fetch status (matches TanStack / RemoteData). Elevating them in a pure check/classifier keeps the I/O union minimal and the policy testable.
- **A single fixed-layout `<EmptyState>`.** Empty layouts differ across surfaces; a variant family (not one rigid component) is correct.

## Consequences

**Positive**

- **Immediately actionable on the current `AsyncState` stack** — decoupled from any Suspense migration.
- One copy/token source per state; `forbidden` becomes a real, consistent component.
- Rendering-strategy-agnostic → the components survive the ADR-020 migration **unchanged** (only their mount point moves).

**Costs**

- A multi-PR migration touching ~6 existing components + inline sites.
- `<EmptyState>` / `<ErrorState>` need design input (illustration, copy, CTA).

**Migration (follow-ups)**

1. Build the canonical components + `error-classify.ts` (+ tests).
2. Replace/compose the scattered variants; migrate inline empty/error blocks to wire `<LoadingState>`/`<ErrorState>`/`<EmptyState>` into the existing container `AsyncState` branches (ADR-017 §3).
3. Surface `<PermissionState>` + forbidden classification when the coded error-state (ADR-017 §3b Phase 2) lands.

## Related files / ADRs

- ADRs: [017](./017-frontend-component-layering.md) (state model), [020](./020-boundary-read-rendering.md) (boundary-hoisted rendering — the target *where* these mount for suspense reads), [008](./008-error-handling-strategy.md) (`FORBIDDEN`), [013](./013-i18n-architecture.md).
- To consolidate: `_components/shared/async-state-views.tsx`; `_components/common/{ErrorState,LoadingState}.tsx`; `features/scan/{ScanEmptyState,ScanErrorState}.tsx`; `features/admin/infrastructure/InfrastructureEmptyState.tsx`; `app/components/ui/Table.tsx` (inline empty).
