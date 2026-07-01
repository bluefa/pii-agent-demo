# Frontend Code Review — 2026-07-02

Codebase-wide review of the frontend (432 TS/TSX files). Successor to `frontend-anti-patterns-audit-2026-04-23.md`, which predates the ADR-019 migration and is now stale (it references the removed `lib/api-client/` layer). Five parallel reviewers covered: `app/hooks` + `app/lib/api`, `app/api` + `app/integration/api` + `lib/bff`, `app/components`, `app/integration` pages, and top-level `lib/`. Every finding below was verified against the actual code (file:line + grep for importers).

## Scope

- `app/**`, `lib/**` (excluding tests and `lib/generated/` codegen output)
- Baseline: branch `main` @ `fa608ffd`

## Baseline health

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 real errors (`.next/**/types/validator.ts` stale-cache errors only — known issue) |
| `npm run lint` | 0 errors, 33 warnings (all `no-unused-vars` in mocks) |
| `vitest run` | 994/994 passed (129 files) |

Note: a local `node_modules` drift (zod 4.3.6 installed vs 3.25.76 locked) initially produced phantom tsc errors in `lib/generated/install-v1.ts` and `ScanPanel.tsx`; `npm install` resolved it. Not a code issue, but worth knowing if tsc suddenly reports `z.record` arity errors.

Overall the codebase is in good shape: no `any`, generated contract not hand-edited, casing boundaries (D1/D6) respected in routes, and several exemplary patterns (`useApprovalTableState`, `ServiceListPanel`, the IDC abort-guard hooks). The problems are concentrated in four areas: **correctness bugs in shared hooks**, **dead code**, **contract-type drift**, and **Cloud↔IDC duplication**.

## Severity legend

- 🔴 P1 — user-facing correctness bug; fix now
- 🟡 P2 — high-value hygiene/architecture; next PRs
- 🟢 P3 — opportunistic

---

## P1 — Correctness bugs in shared polling/status hooks 🔴

The one cluster of genuine runtime bugs. All four live in hooks that back live UI.

### P1-1 `useInstallationStatus` has no abort/stale-response guard (race condition)

`app/hooks/useInstallationStatus.ts:43-68` — `run()` awaits `fetcher(targetSourceId)` then unconditionally `setStatus(data)`. No AbortController, no "is this still the current id?" check; the effect refires on id change but never cancels the in-flight request, so a late response from the previous `targetSourceId` overwrites the current one. Backs all three cloud install panels (`AwsInstallationInline.tsx:48`, `AzureInstallationInline.tsx:90`, `GcpInstallationInline.tsx:44`). The sibling `useIdcInstallationStatus.ts` already solves exactly this — the generic hook is the drift. **Impact: high · Effort: M**

### P1-2 `useTestConnectionPolling` swallows every fetch error as "no test yet"

`app/hooks/useTestConnectionPolling.ts:42-50` — `catch { return null; }` is unconditional, so a 500/network failure renders as IDLE forever instead of surfacing. Contrast `useScanPolling.ts:42-50`, which maps only `NOT_FOUND` to `null` and rethrows the rest. **Impact: medium · Effort: S**

### P1-3 `usePollingBase` polls a hard-failing endpoint forever

`app/hooks/usePollingBase.ts:65-103` — in `tick()`, the catch (88-91) sets error state but never clears the interval; `shouldStop` is only consulted on success. A persistently failing endpoint is hammered indefinitely with `isPolling === true`. **Impact: medium · Effort: M**

### P1-4 `usePollingBase.refresh()` calls state setters after unmount

`app/hooks/usePollingBase.ts:51-60` — the polling effect has a `cancelled` flag but the standalone `refresh` callback does not; a slow refresh resolving after unmount still calls `setData`/`setError`/`onUpdate` unguarded. (Refresh after `stop()` is legitimate manual usage — the gap is unmount only.) **Impact: low · Effort: S**

**→ Selected as the implementation target of this PR.** Rationale: only cluster with real user-facing failure modes (stale install status rendered for the wrong target source; failures silently shown as idle; runaway polling), bounded scope (3 hook files + tests), and existing test infrastructure (`useTestConnectionPolling.test.ts`) to extend.

---

## P2 — High-value follow-ups 🟡

### P2-1 Dead code sweep (~25 files/exports, zero importers — all grep-verified)

One deletion PR removes ~2,000 lines of dead surface, including 4 of the worst raw-color offenders for free:

- **Components (12)**: `ProcessGuideStepCard.tsx` (255L), `ApprovalRequestDetailModal.tsx` (270L), `ConnectionHistoryTab.tsx`, `CredentialListTab.tsx`, `StepIndicator.tsx`, `ProcessGuideTimeline.tsx`, `ProcessTimelineCompact.tsx`, `ApprovalApplyingBanner.tsx`, `process-status/shared/ActionCard.tsx`, `aws/AwsInstallModeCard.tsx`, `ui/CollapsibleSection.tsx`, `ui/ScanPill.tsx` (+ its test)
- **target-sources (4)**: `idc/steps/connection-test-adapter.ts` (+ test), `layout/ConnectionTestSlot.tsx`, `layout/TargetConfirmationInstructionCard.tsx`, `logical-db/LogicalDbSlot.tsx`
- **Hooks/API (7 exports)**: `useAsync.ts` (whole file), `fetchInfraCamelJson`, `getOccupiedResources`, `getNlbTable`, `getScanHistory`, `getAzurePrivateLinkHealthCheck`, `getGcpScanServiceAccount`/`getGcpTerraformServiceAccount`
- **lib (2 modules)**: `lib/logical-db-counts.ts` (+ test), `lib/utils/credentials.ts`
- **BFF (1 surface, 4 layers)**: `bff.scan.get(id, scanId)` in `lib/bff/types.ts:52`, `http.ts:137`, `mock-adapter.ts:63`, `mock/scan.ts:20`
- **Route lib**: `resolveProject` + its `IS_MOCK` const in `app/api/_lib/target-source.ts:32-59` (also removes the inverted `USE_MOCK_DATA !== 'false'` default that contradicts `lib/bff/client.ts:6`)

Caveat: confirm `CredentialListTab`/`ConnectionHistoryTab` with the author before deleting (look like superseded legacy tabs; no live wiring exists).

### P2-2 ADR-019 contract-type drift: hand-written wire DTOs shadow the generated contract

- `lib/types.ts:817-899` — 5 hand-written snake_case DTOs (`ResourceSnapshot`, `BffExcludedResourceInfo`, `ConfirmedIntegrationResourceInfo`, `BffApprovedIntegration`, `BffConfirmedIntegration`) re-type Swagger shapes by hand. `BffApprovedIntegration` declares `resource_infos`/`excluded_*` fields that the generated `ApprovedIntegrationResponseDto` does not have (it has `resources` + `approved_by`) — the approved-integration shape now exists in **three** disjoint versions (generated / lib/types / inline in `app/lib/api/index.ts:426-437`).
- `app/api/_lib/v1-types.ts` — hand-maintains `GcpInstallationStatusResponse`, `AwsInstallationStatusResponse`, etc. Routes validate with generated schemas but client components import the hand-written copies (`GcpInstallationInline.tsx:23`, `gcp/installation-status-adapter.ts:28`, `lib/constants/gcp.ts:1`) — two sources of truth that drift without compile errors.
- Related casts that this drift forces: `app/lib/api/index.ts:464,466` (`as unknown as` reshaping), `:453` (`approved_by as { user_id?: string }`), `logical-db.ts:48,55,56` (unchecked enum casts — contrast the guarded `toDbTypeWire` in `idc.ts:174-179`).

**Effort: M/L** (touches client code) — highest architectural value after P1.

### P2-3 Cloud↔IDC connection-test duplication (~200 lines, byte-identical blocks)

`layout/ConnectionTestCard.tsx` (360L) ≈ `idc/steps/IdcStep5ConnectionTest.tsx` (378L): `statusByResource`, `rowConnected`, count/progress math, `progressState`/`progressLabel`, `handleCredChange`, and the Run Test header are copy-pasted (both files' comments admit the mirroring). Polling is already shared via `useTestConnectionPolling`; extract a `useConnectionTest` hook + shared card, providers inject resource source + approval modal. Related: `CloudTargetSourceLayout` vs `IdcTargetSourceLayout` (identical status→step dispatchers), step chrome duplicated across 15 step files (`StepProps` redeclared ~10×, `refreshProject` callback copy-pasted 7×). **Effort: L** — biggest LOC/divergence-risk win, do after P1/P2-1 shrink the surface.

### P2-4 ProblemDetails contract bug on two 404 routes

`app/integration/api/v1/target-sources/[targetSourceId]/approved-integration/route.ts:9-21` and `.../confirmed-integration/route.ts:8-20` hand-roll the problem+json body: `title` diverges from `ERROR_CATALOG` and the **required `timestamp` field is missing**. `createProblem(...)` is a drop-in replacement. **Effort: S** — genuine client-facing bug; bundle into any nearby PR.

---

## P3 — Opportunistic 🟢

- **Theme-token violations (live code)**: `candidate/VmDatabaseConfigPanel.tsx` (59 raw color hits, worst in repo; needs `focus:border`/gradient tokens added to theme.ts first), `ConnectionDetailModal.tsx` (23 hits + reinvents Modal/Table), `ApprovalModals.tsx` (10 hits, hand-rolled overlay + green/red buttons), `WaitingApprovalToolbar.tsx` (29 raw hex, v15 pixel-matching), `api-docs/page.tsx` (whole file off-theme), history/* panels (neutral grays).
- **Competing table styles**: `ui/Table.tsx:101-118` hardcodes the legacy `uppercase tracking-wider` header that `theme.ts` `tableStyles` (v15) explicitly forbids; `ui/Table` itself should consume `tableStyles`. Meanwhile the entire target-sources directory hand-rolls `<table>` (12 sites, zero `ui/Table` importers there).
- **Missing UI primitives**: no `Tabs`/`SegmentedControl` (3 independent roving-tabindex implementations in admin/guides: `ProviderTabs`, `EditLanguageTabs`, `PreviewLanguageToggle` — the latter two near-identical), no `Select`; 3 modals hand-roll `role="dialog"` instead of `ui/Modal` (`IdcReqApprovalModal`, `CloudReqApprovalModal`, `ConfirmRewindModal`); `IdcLoadRequestModal` hand-rolls pagination.
- **Abort-guard consolidation**: `useIdcInstallationStatus`, `useIdcPreviousRequest`, `useIdcResources` each hand-reimplement the AbortController + stale-guard that `useAbortableEffect.ts` exists to provide (and nothing uses it).
- **Misc**: `app/lib/api/infra.ts:14` `console.log` of internal request paths on every call; request bodies asserted with `as z.infer<...>` instead of `.parse()` (`test-connection-acknowledgment/route.ts:17`, `excluded-databases/by-resource-id/route.ts:39`, the latter also missing `.catch()` on `request.json()`); cross-endpoint join inside `process-status/route.ts:26-51`; 38 routes repeat the identical `parseTargetSourceId` guard (a `withTargetSource` wrapper would delete ~150 lines); `IdcStep1TargetInput` uses 7 ad-hoc modal booleans instead of `useModal()`; admin casts `ProviderTabs.tsx:119` (`as never`), `GuidePreviewPanel.tsx:110` (`as ProcessStatus`); lint's 33 unused-var warnings.

---

## Verified non-issues (do not re-flag)

- Azure vs GCP `installation-status-adapter.ts` similarity is **not** unifiable — different domain types and enum-narrowing tables per ADR-019.
- AWS/Azure/GCP `ProjectPage`/`InstallationStatus` files are thin and well-factored; differences are essential.
- `lib/object-case.ts` is the single case-conversion source; no competing utility.
- `lib/generated/install-v1.ts` has no hand edits (git log: only codegen commits #508, #515).
- `getStore()` seed behavior is consistent (the one non-mock caller guards with `IS_MOCK`).
- Memory-note corrections: the test-connection routes now all use generated schemas (the "hand-written normalizer" pilot note is resolved); ConnectionTestCard/IdcStep5 are live-wired, not v16 stubs — the real orphans are the 4 files in P2-1.

## Recommended PR sequence

1. **This PR (P1)**: polling/installation-status hook correctness fixes + tests, plus this report.
2. P2-1 dead-code sweep (S, zero risk, −~2,000 lines).
3. P2-4 ProblemDetails fix (S) — can ride along with 2.
4. P2-2 contract-type consolidation (M/L).
5. P2-3 connection-test extraction (L).
6. P3 items opportunistically, in the order listed.
