# ADR-012 Phase 1 — Azure `INSTALLING` Proof of Concept

## Intent

Land the first slice of the ADR-012 migration: introduce `CloudTargetSourceLayout` and only the components required for **Azure `INSTALLING`**, route that single (provider, step) combination through the new path, and ship the **R1 source-text architecture test** so provider-axis branches cannot enter the layout component on day one.

This is the visible-value PR. It fixes `/integration/target-sources/1003`, where the "설치 상태 조회" card currently renders below the integration table due to PR #371's fragment ordering.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md) (commit `f1a23b4`).

## Required Outcome

After this PR is merged:

1. `/integration/target-sources/1003` (Azure `INSTALLING`, seed data at `lib/mock-data.ts:170-182`) renders **`InstallationStatusSlot` before `ConfirmedResourcesSlot`** — i.e. the installation-status card is above the integration table.
2. All other (provider, step) combinations render **identically to before this PR**. AWS / GCP installing, all connection-test steps, all approval steps, all candidate steps remain on the legacy path.
3. The R1 architecture test passes: `CloudTargetSourceLayout.tsx` does not contain the strings `cloudProvider` or `awsInstallationMode`.
4. The Azure `InstallingStep` order test passes: rendering with mock Azure-installing project shows `installation-status` before `confirmed-resources`.

## Scope

| Area | Required action |
|---|---|
| **Layout entry** | Add `_components/layout/CloudTargetSourceLayout.tsx`. The switch initially has one explicit case (`INSTALLING` → `<InstallingStep />`); other `ProcessStatus` values fall through to the existing legacy path via the caller (see Implementation Steps §3). |
| **Step gate** | Add `_components/layout/InstallingStep.tsx`. Picks `AwsManualInstallingStep` when `cloudProvider === 'AWS' && awsInstallationMode === 'MANUAL'`; otherwise returns `CloudInstallingStep`. (`AwsManualInstallingStep` is a stub for phase 1 — see §Out of Scope.) |
| **Default body** | Add `_components/layout/CloudInstallingStep.tsx`. Renders `<ConfirmedIntegrationDataProvider>` wrapping `ProjectPageMeta`, `ProcessStatusCard`, `GuideCard`, `InstallationStatusSlot`, `ConfirmedResourcesSlot`, `RejectionAlert` in this exact order. |
| **Provider slot** | Add `_components/layout/InstallationStatusSlot.tsx`. Switches on `cloudProvider` and dispatches to `AzureInstallationStatus` (phase 1 only routes Azure here; AWS/GCP cases return `null` until phase 2). |
| **Confirmed slot** | Add `_components/layout/ConfirmedResourcesSlot.tsx`. Reads `useConfirmedIntegration()` and renders the existing confirmed table presentation (extracted from `ConfirmedIntegrationSection`'s body). |
| **Data provider** | Add `_components/data/ConfirmedIntegrationDataProvider.tsx` exporting `ConfirmedIntegrationDataProvider` (component) and `useConfirmedIntegration` (hook). Lifecycle exactly per ADR §Data Fetching Decoupling. |
| **Azure adapter** | Add `_components/azure/AzureInstallationStatus.tsx`. Reads `useConfirmedIntegration()` and forwards `confirmed` to the existing `AzureInstallationInline` component. No new logic — pure adapter. |
| **Routing hook** | Modify `_components/azure/AzureProjectPage.tsx` so that when `processStatus === ProcessStatus.INSTALLING`, it returns `<CloudTargetSourceLayout project={project} onProjectUpdate={onProjectUpdate} />` instead of the existing inline structure. All other steps keep the existing render path unchanged. |
| **R1 test** | Add `_components/layout/CloudTargetSourceLayout.architecture.test.ts` per ADR §Test Strategy. Use `\bcloudProvider\b` / `\bawsInstallationMode\b` regex (not bare substring) to avoid comment/import false positives. |
| **Order test** | Add `_components/layout/CloudInstallingStep.test.tsx`. Renders with a mock Azure-installing `CloudTargetSource`, asserts `getAllByRole('region')` ordering: `installation-status` index < `confirmed-resources` index. Mock child cards as needed; do not depend on real API calls. |

## Implementation Steps

### 1. Data layer (independent, fan-out target)

Author `ConfirmedIntegrationDataProvider` and `useConfirmedIntegration`. Lifecycle:

1. On mount, create `AbortController`, set state to `loading`, call `getConfirmedIntegration(targetSourceId, { signal })`.
2. On unmount, abort.
3. On `targetSourceId` change, abort old, reset to `loading`, fetch new.
4. On manual retry (exposed as a method on the hook return), abort in-flight, refetch.
5. Treat missing-confirmed-integration error (`isMissingConfirmedIntegrationError`) as `ready` with empty array, matching `ConfirmedIntegrationSection.tsx:49-55`.

Callback identity: if the provider accepts a `refreshProject` callback, store it in a ref to avoid re-triggering the fetch effect, mirroring `ConfirmedIntegrationSection.tsx:35-40`.

Hook return type: `AsyncState<readonly ConfirmedResource[]>` (existing type at `_components/shared/async-state.ts`).

### 2. Layout components (sequential after data layer)

Author in order: `InstallationStatusSlot` → `ConfirmedResourcesSlot` → `AzureInstallationStatus` (Azure adapter) → `CloudInstallingStep` → `InstallingStep` → `CloudTargetSourceLayout`.

`AzureInstallationStatus` wraps the existing `AzureInstallationInline` to keep the Azure installation logic in its current file — adapter only, no business logic in the slot.

### 3. Routing hook (single edit to `AzureProjectPage.tsx`)

Replace the `ResourceSection` render branch for `processStatus === INSTALLING` with `<CloudTargetSourceLayout project={project} onProjectUpdate={onProjectUpdate} />`. Keep meta / status card / guide card rendering for non-INSTALLING steps as a fallback; these are migrated in phases 3-4. Do not touch `AwsProjectPage.tsx` or `GcpProjectPage.tsx`.

### 4. Tests

- R1 source-text test (phase 1 makes this required green).
- Azure `InstallingStep` order test.
- Existing 326 vitest cases must stay green.

### 5. Verify, commit, push, PR

Per `/wave-task` Phase 4-6.

## Subagent Fan-out (per `/wave-task` Subagent Usage)

| Substep | Fan-out target | Constraint |
|---|---|---|
| §1 Data layer | One subagent — independent (no dependency on layout files). | Must include lifecycle tests for `ConfirmedIntegrationDataProvider` (mount/unmount/id-change/retry/missing-integration). |
| §2 Layout components | Sequential — each layer depends on the next. Do not fan out. | — |
| §3 Routing hook | Sequential after §2. | Single file edit; do not fan out. |
| §4 Tests | Two subagents in parallel: (a) R1 architecture test, (b) Azure `InstallingStep` order test. | (a) and (b) live in different files and have no shared state. |

## Guardrails

- **R1**: `CloudTargetSourceLayout.tsx` must not reference `cloudProvider` or `awsInstallationMode`. Test enforces this.
- **R2**: `InstallationStatusSlot.tsx` and `ConfirmedResourcesSlot.tsx` must only switch and dispatch. No `useState` / `useEffect` for business state. No data fetching (the provider does that). Slot files target ≤50 lines.
- **R3**: This phase introduces only `CloudInstallingStep` (default body) and `AwsManualInstallingStep` (stub). It does not introduce `AzureInstallingStep` or `GcpInstallingStep` because their card order is identical to `CloudInstallingStep`.
- **R4**: `ConfirmedIntegrationDataProvider` exposes confirmed-integration data only. Do not add candidate / approved / guide / permission fields.
- **C1**: `CloudTargetSourceLayout` and the new step components must not be imported by `*ProjectPage.tsx` files in a way that surfaces `ConfirmedResource` to the page. The page receives only `CloudTargetSourceLayout` as JSX; the `ConfirmedResource` type is consumed inside the layout subtree.
- Provider pages keep their existing C1 surface (only `CloudTargetSource`, no resource-domain types).
- No raw color classes — use `lib/theme.ts` tokens, including in any new presentation glue.

## Out of Scope (Phase 1)

The following land in later phases. Do **not** implement them in this PR even if convenient:

- `WaitingTargetConfirmationStep`, `WaitingApprovalStep`, `ApplyingApprovedStep`, `ConnectionTestStep` step components (phases 3-4).
- `AwsInstallationStatus`, `GcpInstallationStatus` adapters (phase 2).
- AWS / GCP routing through `CloudTargetSourceLayout` (phase 2).
- `AwsManualInstallingStep` body — phase 1 ships the gate but the override component itself is a stub returning `<CloudInstallingStep>`. Real divergent JSX comes when AWS manual flow is migrated (phase 2).
- Extracting `ApprovalWaitingCard` / `ApprovalApplyingBanner` from `ProcessStatusCard` (phase 3).
- Deleting `ResourceSection.tsx` (phase 4).
- Lint/grep rule against `*ProjectPage.tsx` importing `@/lib/types/resources` (phase 5).

If implementation requires touching anything in this list to keep `tsc` green, stop and report instead of expanding scope.

## Acceptance Criteria

- `/integration/target-sources/1003` renders installation-status card above integration table (manually verified, screenshot in PR description).
- All other target-source URLs render identically to before this PR (smoke-checked: at least one AWS, one GCP, and one non-INSTALLING Azure target source).
- R1 architecture test exists and passes.
- Azure `InstallingStep` DOM-order test exists and passes.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings introduced.
- `npm run test:run`: existing 326 + new tests all green.
- `npm run build`: clean.
- `*ProjectPage.tsx` files do not import `@/lib/types/resources` (already true; this PR must not regress it).

## Verification Commands

```bash
# R1 source-text guard (sanity check before relying on the test):
rg -n "cloudProvider|awsInstallationMode" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx
# Expected: 0 hits.

# Provider page resource-type guard (C1 from #371):
rg -n "from '@/lib/types/resources'" \
  app/integration/target-sources/\[targetSourceId\]/_components/{aws,azure,gcp}/*ProjectPage.tsx
# Expected: 0 hits.

# Slot purity (R2):
rg -nE "useState|useEffect" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/{InstallationStatusSlot,ConfirmedResourcesSlot}.tsx
# Expected: 0 hits.

# Test + type + lint + build:
npx tsc --noEmit
npm run lint
npm run test:run
npm run build

# Regression check — Azure 1003 visual order:
# Manual: open http://localhost:3000/integration/target-sources/1003 and confirm
# the installation-status card sits above the integration table.
```

## PR Description Template

When this spec lands as a PR, the description must include:

- Spec path + commit SHA: `docs/reports/sit-migration-prompts/adr012-phase1-azure-installing.md @ <SHA>`
- ADR reference: ADR-012 §Migration Plan Phase 1
- Files added (with LOC) and the single file modified (`AzureProjectPage.tsx`)
- Visual confirmation: before/after screenshot of `/integration/target-sources/1003`
- Test additions: R1 architecture test + Azure order test
- `tsc` / `lint` / `test` / `build` results
- Out-of-scope items explicitly listed (per §Out of Scope)

## Why This Phase Lands First

- It directly fixes the user-reported regression that triggered ADR-012.
- It validates the architectural rules (R1-R4) on a single concrete migration before they are applied to the rest of the page.
- It establishes the data provider lifecycle in a real context, which phases 2-4 reuse without re-inventing.
- It is reviewable in one sitting — single provider, single step, narrow file count.
