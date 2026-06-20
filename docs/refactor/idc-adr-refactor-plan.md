# IDC Component Refactor — ADR-017 / ADR-018 Implementation Plan

> Session goal: make the IDC integration UI conform to **ADR-017** (component
> layering) and **ADR-018** (state-view components). **Component refactoring
> only — zero API contract changes.** Grounded in the current code map (worktree
> `refactor/idc-adr-refactor`, base `main@9465997`).

## Non-goals (explicitly OUT this session)

- **API / endpoint changes.** No `updateIdcResources` → `createApprovalRequest`,
  no `swagger/idc.yaml` edits, no change under `app/lib/api/**` except the
  W3 wire-enum derivation. The IDC→cloud-shared-API migration is deferred.
- **ADR-020** Suspense / Error-Boundary rewrite (Proposed target, not now).
- **App-wide** consolidation of the scattered state views (`ScanEmptyState`,
  `InfrastructureEmptyState`, `common/ErrorState`, `async-state-views.tsx`).
  This session touches **IDC call-sites only**; the cross-feature sweep is a
  follow-up.
- **`PermissionState` / forbidden classification** (ADR-018 Phase 2, blocked on
  the ADR-017 §3b coded error-state — does not exist yet).
- **Boundary validation / parse-don't-validate adapters** (ADR-017 migration #3,
  needs zod; deferred).

## Current state (from the code map)

- **Adapter layer is already clean** ✅ — `app/lib/api/idc.ts` centralizes every
  wire↔domain transform (`toIdcResourceView` / `toIdcResourceInput` /
  `toIdcInstallationView`). ADR-017 ② is satisfied. **Do not touch it.**
- **7 steps each roll their own inline state UI** — `<div>로딩 중…</div>` and
  `<div>{error}</div>`, Step 1 a custom empty block. None use a shared component.
- **Steps 2 / 3 / 6 / 7 are near-identical** — same `getIdcResources` fetch, same
  `ResourcesState = {loading|ready|error}` union, same abort/stale race-guard,
  copy-pasted 4×.
- **Repo has scattered state views** (`InstallationErrorView`, `ScanErrorState`,
  `ScanEmptyState`, `common/*`) — IDC uses **none** of them.
- **`IdcDatabaseTypeWire` leaks** into `IdcTargetFormModal` (a presentational ⑧
  file holds a wire enum) — ADR-017 migration #2.

## Scope — 4 work items

### W0 — Canonical state components  *(ADR-018 §1, §4)*  — FOUNDATION, blocks W1 & W2

Build `app/components/ui/state/`:

```
EmptyState.tsx    # ⑧ — variant family: block | inline | card; slots icon?/title?/description?/action?
ErrorState.tsx    # ⑧ — title + description + optional retry; renders `message` (ADR-017 §3b Phase 1)
LoadingState.tsx  # ⑧ — promoted shape of the inline "로딩 중…" blocks
index.ts
```

- Token-based props only, no raw values (CLAUDE.md #4).
- **Skip** `error-classify.ts` and `PermissionState.tsx` — Phase 2, deferred.
- Render tests (vitest, the existing pattern in `useApiMutation.test.ts`).
- **Verify:** vitest render tests pass; `tsc --noEmit` clean.

### W1 — Swap inline state blocks in Step 1 / 4 / 5  *(ADR-018 §2)*

These three steps keep their own fetch (Step 1 editable working-list, Step 4
installation-status hook, Step 5 connection-test sim — each special, not foldable
into a shared read hook). Only **replace** their inline loading / error / empty
markup with `<LoadingState>` / `<ErrorState>` / `<EmptyState>` from W0.

- Files: `steps/IdcStep1TargetInput.tsx`, `steps/IdcStep4Installing.tsx`,
  `steps/IdcStep5ConnectionTest.tsx`.
- No fetch/behavior change. Visual parity.
- **Verify:** `tsc` + `lint` clean; each step renders the same states.

### W2 — Extract `useIdcResources` + thin read-steps 2 / 3 / 6 / 7  *(ADR-017 §3, §5, migration #4)*

The biggest dedup. Lift the 4× copy-pasted read into one hook, rewrite the steps
as thin containers.

- New `app/hooks/useIdcResources.ts`: `getIdcResources` + `ResourcesState` +
  abort/stale guard (exactly the logic duplicated in steps 2/3/6/7 today).
- Rewrite Step 2 / 3 / 6 / 7: `useIdcResources(targetSourceId)` → render
  `<LoadingState/>` / `<ErrorState/>` / empty-check `<EmptyState/>` / `IdcResourceTable`.
  Keep each step's distinct copy + buttons (cancel / retest stubs).
- Files: `steps/IdcStep2WaitingApproval.tsx`, `…Step3Applying.tsx`,
  `…Step6ConnectionVerified.tsx`, `…Step7Complete.tsx`, new `app/hooks/useIdcResources.ts`.
- **Trim option:** if this feels too aggressive, drop the hook and just do the
  W1-style state-component swap on these 4 steps too. Loses the dedup, keeps the
  ADR-018 win. Decide before launch.
- **Verify:** `tsc` + `lint` clean; behavior identical (loading→ready→error,
  cancel/retest still wired); visual parity.

### W3 — Close the `IdcDatabaseTypeWire` leak  *(ADR-017 §2, migration #2)*

- Remove the wire enum from `modals/IdcTargetFormModal.tsx` (presentational ⑧);
  derive at the boundary (`idcDbTypeWireFromLabel`) so the wire type leaves ⑧.
- File: `modals/IdcTargetFormModal.tsx` (+ boundary helper if needed).
- **Verify:** `tsc` + `lint`; the proposed presentational wire-import rule would pass.

## Dependencies / parallelization

```
W0  (sequential — W1 & W2 import its components)
└─► W1 ┐
    W2 ├─ parallel, file-disjoint
    W3 ┘
```

W1 / W2 / W3 touch **disjoint file sets** → safe to fan out to parallel subagents
once W0 lands.

## Whole-session verification

- `npx tsc --noEmit` clean.
- `npm run lint` clean. *(Known pre-existing: `IdcStep1TargetInput.tsx:80`
  react-hooks/refs "Cannot update ref during render" — from #497, NOT ours; do
  not fix here.)*
- vitest: new state-component tests pass; existing suite green.
- **`git diff` shows no change under `app/lib/api/**` (except W3) or
  `docs/swagger/**`** — the proof that this session changed zero API contract.
- Visual parity across all 7 steps.

## Out-of-scope follow-ups (named, not done)

1. App-wide state-view consolidation (Scan / Infra / common / `async-state-views`).
2. ADR-017 migration #3 — boundary validation (parse-don't-validate, zod).
3. ADR-020 — Suspense / Error-Boundary rewire (the *where* these mount).
4. ADR-018 Phase 2 — `PermissionState` + forbidden classification.
5. IDC → cloud-shared-API migration (`createApprovalRequest` etc.).
