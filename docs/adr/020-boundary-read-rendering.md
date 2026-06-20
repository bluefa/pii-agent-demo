# ADR-020: Boundary-Hoisted Read Rendering (Suspense + Error Boundary)

## Status

Proposed (2026-06-20). **Target** rendering architecture for **suspense-capable read paths**. **Amends [ADR-017](./017-frontend-component-layering.md) §3** for the read path only. **Not immediately normative** — non-suspense reads and all writes keep ADR-017 §3.

Composes with:

- [ADR-017](./017-frontend-component-layering.md) — §3 (read path) is amended here; §3b (staged error-state) is reused. Containers still own non-suspense reads and all writes.
- [ADR-018](./018-state-view-components.md) — the state-view components (`LoadingState` / `ErrorState` / `PermissionState` / `EmptyState`) are what the boundaries/fallbacks render. ADR-018 is adoptable independently of this ADR.
- [ADR-008](./008-error-handling-strategy.md) — `FORBIDDEN`; writes keep the 2-layer model.
- [ADR-013](./013-i18n-architecture.md) — error copy from `code` (§3b Phase 2).

## Scope

- **Target, not immediate.** Applies to **suspense-capable reads** (`useSuspenseQuery` / RSC).
- **Non-suspense reads keep ADR-017 §3** — the container reduces `AsyncState` (`loading | ready | error`) and renders via an explicit branch. `AsyncState` is **legacy/transitional**, valid until a path migrates — **not retired**.
- **Writes are out of scope** except to reaffirm ADR-017 §3 (local handling). Error Boundaries do **not** catch event-handler / async-callback errors.

One-line model:

```
non-suspense read → container reduces AsyncState (ADR-017 §3) + local empty check
suspense read     → Suspense (loading) + ErrorBoundary (error/forbidden) + local empty check
write             → event handler: catch → classify → toast / error-state (ADR-017 §3)
```

## Context

ADR-017 §3 has the container reduce every read to a state and render it via an explicit branch:

```tsx
if (state.status === 'loading') return <LoadingState />;
if (state.status === 'error')   return <ErrorState message={state.message} onRetry={refetch} />;
// ready → local empty check → content
```

This is explicit and correct, but the loading/error wiring is **repeated at every call site** — high blast radius (changing how loading or error renders means touching every screen). The industry minimizes this by **hoisting loading/error to boundaries**. The current stack (`useEffect` + `AsyncState`) is **not** suspense-based, so this is a **target + migration**, not an immediate change.

## Industry survey

- **Suspense (loading) + Error Boundary (error)** is the modern React standard — declare once around a subtree; descendants inherit. ([Modern React data fetching](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained))
- **`useSuspenseQuery`** returns `data: T` with **no `isLoading` / `isError`** — loading is delegated to the nearest Suspense boundary, errors to the nearest Error Boundary. ([TanStack Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense))
- **Next.js App Router** `loading.tsx` (auto-Suspense) + `error.tsx` (Error Boundary) per route segment. This repo already has `error.tsx` in the target-source route. ([Next.js error handling](https://nextjs.org/learn/dashboard-app/error-handling))

## Decision

### 1. Strategy (suspense-capable reads only)

- **loading → `<Suspense>`**, **error/forbidden → `<ErrorBoundary>`**, declared **once per subtree** (or per route via `loading.tsx` / `error.tsx`). A component reading via a suspense source carries **no loading/error code**.
- A shared **`<StateBoundary>`** bundles `ErrorBoundary` + `Suspense` with **default fallbacks** drawn from ADR-018 (`<LoadingState/>`; error → `<ErrorState/>` / `<PermissionState/>`). Change a fallback once → every descendant inherits. **This is the blast-radius win.**
- **forbidden**: the Error-Boundary fallback branches via ADR-018's `error-classify.ts` (`error.code === 'FORBIDDEN'` → `<PermissionState/>`; Phase 1 → `<ErrorState/>`).
- **empty stays local** (ADR-018) — a successful render with no rows is not an exception; the component checks `isEmpty(data)`.

### 2. Read = boundary; write = local

React Error Boundaries catch errors thrown during **render**, *not* in **event handlers / async callbacks**. A mutation error (e.g. IDC submit `onClick → updateIdcResources`) does **not** reach a boundary. **Writes keep ADR-017 §3** — the handler reduces the error to a toast / error-state; an empty/swallowed catch stays forbidden. The IDC incident was a *write* — it is fixed with `useApiMutation`, not a boundary.

> Stated plainly so it is never misread: declarative data-for-render hoists to Suspense / Error Boundary; imperative actions handle their own outcome locally.

### 3. Amendment to ADR-017 §3 (read path only)

For **suspense-capable** reads, loading/error/forbidden hoist to boundaries instead of being reduced in the container. ADR-017 §3's container-reduction model **remains in force** for **non-suspense reads** and is **unchanged for writes**. ADR-017 §3a's `loading | ready | empty | error | forbidden` set is unchanged as the *vocabulary*; this ADR only changes *where* loading/error/forbidden are handled for suspense reads.

### 4. Migration (incremental; legacy `AsyncState` retained)

1. Build `<StateBoundary>` (Error Boundary + Suspense + ADR-018 default fallbacks).
2. Add route `loading.tsx`; wire the existing `error.tsx` fallback to `<ErrorState>` (branch to `<PermissionState>` in Phase 2).
3. Apply boundaries to **new screens and explicit migration targets first** — not a blanket rewrite. Migrate a read to `useSuspenseQuery` / RSC, then drop its per-screen loading/error wiring.
4. **Unmigrated screens keep the `AsyncState` path** (ADR-017 §3). No screen is forced to migrate.

### Considered and rejected

- **Per-call-site `AsyncState` reduction as the *target*.** It is correct and Suspense-free, but high blast radius. Kept as the **legacy/transitional** path (non-suspense reads), not the target.
- **Pushing state into each leaf** (smart data components). Cuts call sites but couples leaves to a data source and risks fetch waterfalls (ADR-017 fetch-high / render-low). Rejected in favor of boundaries.
- **Big-bang Suspense migration.** Rejected — incremental, new-and-target-first; `AsyncState` stays valid until each path moves.

## Consequences

**Positive**

- For migrated reads, loading/error/forbidden are declared **once per subtree** → minimal blast radius; leaves stay dumb; no fetch waterfalls.
- Uses the `error.tsx` boundary the repo already has; `forbidden` becomes a real, consistent state.
- The ADR-018 components are reused unchanged — only their mount point moves.

**Costs**

- Requires **suspense-capable data** (`useSuspenseQuery` / RSC); the current `useEffect` + `AsyncState` + `useApiMutation` stack is not suspense-based → a real, **incremental** migration.
- Two rendering paths coexist during migration (non-suspense container-reduce + suspense boundary). This is intended, not a defect.

**Migration follow-ups:** see §4. Tracked alongside ADR-018 (components) and ADR-017 follow-up #1 (IDC `handleSubmit` → `useApiMutation`, a *write* fix independent of this ADR).

## Related files / ADRs

- ADRs: [017](./017-frontend-component-layering.md) (§3 read path amended here; §3b reused), [018](./018-state-view-components.md) (the components rendered as fallbacks), [008](./008-error-handling-strategy.md) (`FORBIDDEN`, writes), [013](./013-i18n-architecture.md).
- Touch points: `app/integration/target-sources/[targetSourceId]/error.tsx` (existing Error Boundary); `app/components/ui/state/StateBoundary.tsx` (new); `_components/shared/async-state.ts` (legacy/transitional).
- Industry references: [Suspense + ErrorBoundary](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained), [TanStack useSuspenseQuery](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Next.js loading/error](https://nextjs.org/learn/dashboard-app/error-handling).
