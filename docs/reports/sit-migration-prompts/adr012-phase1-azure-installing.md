# ADR-012 Phase 1 — Azure `INSTALLING` Proof of Concept

## Intent

Land the first slice of the ADR-012 migration: introduce `CloudTargetSourceLayout` and only the components required for **Azure `INSTALLING`**, route that single (provider, step) combination through the new path, and ship the **R1 source-text architecture test** so provider-axis branches cannot enter the layout component on day one.

This is the visible-value PR. It fixes `/integration/target-sources/1003`, where the "설치 상태 조회" card currently renders below the integration table due to PR #371's fragment ordering.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md) (commit `f1a23b4`).

## Required Outcome

After this PR is merged:

1. `/integration/target-sources/1003` (Azure `INSTALLING`, seed data at `lib/mock-data.ts:170-182`) renders **`InstallationStatusSlot` before `ConfirmedResourcesSlot`** — i.e. the installation-status card is above the integration table.
2. All other (provider, step) combinations render **identically to before this PR**. AWS / GCP installing, all connection-test steps, all approval steps, all candidate steps remain on the legacy path.
3. The R1 architecture test passes: `CloudTargetSourceLayout.tsx` does not match `\bcloudProvider\b` or `\bawsInstallationMode\b`.
4. The Azure `CloudInstallingStep` order test passes: rendering with mock Azure-installing project shows `installation-status` region before `confirmed-resources` region.
5. The `ConfirmedIntegrationDataProvider` lifecycle tests pass (mount, unmount abort, target-id change, retry, missing-integration empty-array).

## Component Contract (Critical: must match existing repo APIs)

`CloudTargetSourceLayout` and `CloudInstallingStep` must use the existing `ProjectPageMeta` and `GuideCardContainer` APIs as they exist on the **current `origin/main`** at the time `/wave-task` runs (after the standard Phase 0/rebase). Do not invent shorter aliases. The ADR commit `f1a23b4` is referenced only for the architectural rules, not for component APIs — those evolve on main.

```tsx
// CloudTargetSourceLayout.tsx — Phase 1 props
interface Props {
  project: CloudTargetSource;
  identity: ProjectIdentity;          // resolved by AzureProjectPage; passed through
  providerLabel: string;              // e.g. 'Azure Infrastructure'; passed through
  action: ReactNode;                  // e.g. <DeleteInfrastructureButton />; passed through
  onProjectUpdate: (project: CloudTargetSource) => void;
}
```

`InstallingStep` is the gate component for the `INSTALLING` process status. In Phase 1 it is a no-op pass-through that returns `<CloudInstallingStep ... />`. The gate exists so Phase 2 can add the AWS branch without restructuring the layout. `AwsManualInstallingStep` is **not** introduced in Phase 1.

```tsx
// InstallingStep.tsx — Phase 1 (no-op gate)
export const InstallingStep = (props: Props) => {
  return <CloudInstallingStep {...props} />;
};
```

Phase 2 will add a provider-axis branch inside this component when AWS routing arrives. Do not encode the future branch in a comment in this file — `AwsManualInstallingStep` must not appear as a literal token in Phase 1 source so the R3 verification grep can pass cleanly.

`CloudInstallingStep` receives the same props as the layout, derives `slotKey` for the guide via the existing `resolveStepSlot(project.cloudProvider, ProcessStatus.INSTALLING)` helper at `app/components/features/process-status/GuideCard/resolve-step-slot.ts`, and derives `refreshProject` (a callback that fetches the project and invokes `onProjectUpdate`) so install-completion can propagate to the parent. It does **not** invent its own guide rendering.

`refreshProject` is derived via `useCallback` mirroring the existing pattern at `AzureProjectPage.tsx:60-63`. The implementation should avoid an unnecessary `as CloudTargetSource` cast unless the current `TargetSource` / `CloudTargetSource` alias requires it; if a runtime narrowing is needed, document it inline with one short reason. The spec does not prescribe the cast.

```tsx
// CloudInstallingStep.tsx — render shape (cast omitted intentionally)
const slotKey = resolveStepSlot(project.cloudProvider, ProcessStatus.INSTALLING);

return (
  <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    {slotKey && <GuideCardContainer slotKey={slotKey} />}
    <InstallationStatusSlot project={project} refreshProject={refreshProject} />
    <ConfirmedResourcesSlot />
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
```

`InstallationStatusSlot` accepts `{ project, refreshProject }` and forwards `refreshProject` to the chosen provider-specific status component. `AzureInstallationStatus` reads `useConfirmedIntegration().state` and behaves as follows:

- `state.status === 'ready'`: render `<AzureInstallationInline confirmed={state.data} onInstallComplete={refreshProject} ... />` so the existing install-completion refresh path at `AzureInstallationInline.tsx:139-142` continues to fire.
- `state.status === 'loading' | 'error'`: return `null`. This mirrors the existing gating in `ConfirmedIntegrationSection.tsx:88-96`, where `ConfirmedActions` is mounted only when state is ready. The loading and error UI for the integration data lives in `ConfirmedResourcesSlot` below it; the installation card simply does not appear until confirmed integration is loaded. The Azure adapter must **not** pass `[]` to `AzureInstallationInline` during loading.

Slot-wrapper testability: `InstallationStatusSlot` returns its child wrapped in `<div data-testid="installation-status">`. `ConfirmedResourcesSlot` returns its child wrapped in `<div data-testid="confirmed-resources">`. These wrappers are the order-test selectors.

### Order test sketch (illustrative)

Treat this as an illustrative sketch, not a copy-verbatim template. The implementer is responsible for defining `azureInstallingFixture` and `identityFixture` (typed `CloudTargetSource` and `ProjectIdentity` respectively, derived from `lib/mock-data.ts:170-218` for project 1003) and trimming any unused imports. The non-negotiable parts are: mock `AzureInstallationInline`, mock the data provider to a `ready` state, and assert order via `compareDocumentPosition`.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CloudInstallingStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep';

vi.mock('@/app/components/features/process-status/azure/AzureInstallationInline', () => ({
  AzureInstallationInline: () => <div data-testid="azure-install-stub" />,
}));
vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider', async () => {
  // Stub provider that yields a ready empty array; replaces the real fetch path entirely.
  return {
    ConfirmedIntegrationDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useConfirmedIntegration: () => ({ state: { status: 'ready' as const, data: [] }, retry: () => {} }),
  };
});

describe('CloudInstallingStep DOM order', () => {
  it('renders installation-status before confirmed-resources', () => {
    render(
      <CloudInstallingStep
        project={azureInstallingFixture}
        identity={identityFixture}
        providerLabel="Azure Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );

    const install = screen.getByTestId('installation-status');
    const confirmed = screen.getByTestId('confirmed-resources');
    const ordering = install.compareDocumentPosition(confirmed);

    // Bit DOCUMENT_POSITION_FOLLOWING (4) means `confirmed` follows `install`.
    expect(ordering & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

Mocking `AzureInstallationInline` is required by the test mock-scope rule: the order test concerns slot ordering, not Azure inline behavior.

### Hook contract

```tsx
// ConfirmedIntegrationDataProvider.tsx
export interface ConfirmedIntegrationContextValue {
  state: AsyncState<readonly ConfirmedResource[]>;
  retry: () => void;
}

export const useConfirmedIntegration = (): ConfirmedIntegrationContextValue => { /* useContext */ };
```

`retry` aborts the in-flight request and refetches. Slots that need the data read `state`; the only consumer that calls `retry` in Phase 1 is the error-row UI inside `ConfirmedResourcesSlot`.

## Scope

| Area | Required action |
|---|---|
| **Layout entry** | Add `_components/layout/CloudTargetSourceLayout.tsx`. The switch initially has one explicit case (`INSTALLING` → `<InstallingStep ... />`). Other `ProcessStatus` values do not fall through; the caller (`AzureProjectPage`) must not reach `CloudTargetSourceLayout` for non-`INSTALLING` steps in Phase 1. |
| **Step gate** | Add `_components/layout/InstallingStep.tsx`. Phase 1 is a no-op pass-through that returns `<CloudInstallingStep {...props} />`. Phase 2 will introduce the AWS branch. `AwsManualInstallingStep` is **not** introduced in this phase. |
| **Default body** | Add `_components/layout/CloudInstallingStep.tsx`. Uses the render shape under Component Contract. Derives `refreshProject` from `onProjectUpdate`, derives `slotKey` via `resolveStepSlot`, wraps body in `ConfirmedIntegrationDataProvider`. |
| **Provider slot** | Add `_components/layout/InstallationStatusSlot.tsx`. Accepts `{ project, refreshProject }`. Switches on `cloudProvider` and dispatches to `AzureInstallationStatus`, forwarding `refreshProject`. AWS / GCP cases return `null` until phase 2. |
| **Confirmed slot** | Add `_components/layout/ConfirmedResourcesSlot.tsx`. Reads `useConfirmedIntegration()` and renders a presentation **copied/adapted** from `ConfirmedIntegrationSection`'s body. Do **not** modify `ConfirmedIntegrationSection.tsx` — the legacy section continues to serve non-INSTALLING confirmed steps until phase 2. Calls `retry()` on the error-row retry button. |
| **Data provider** | Add `_components/data/ConfirmedIntegrationDataProvider.tsx` exporting `ConfirmedIntegrationDataProvider`, `useConfirmedIntegration`, and the context-value type. Lifecycle exactly per ADR §Data Fetching Decoupling, with the `{ state, retry }` shape. |
| **Azure adapter** | Add `_components/azure/AzureInstallationStatus.tsx`. Reads `useConfirmedIntegration()`, derives `confirmed` from `state.data` when ready, forwards `confirmed` and `onInstallComplete={refreshProject}` to the existing `AzureInstallationInline` component. No new logic — pure adapter. |
| **Routing hook** | Modify `_components/azure/AzureProjectPage.tsx` so that when `processStatus === ProcessStatus.INSTALLING`, it computes `identity` / `providerLabel` / `action` (existing logic stays in this file) and returns `<CloudTargetSourceLayout project={project} identity={identity} providerLabel="Azure Infrastructure" action={<DeleteInfrastructureButton />} onProjectUpdate={onProjectUpdate} />`. All other steps keep the existing render path unchanged. |
| **R1 test** | Add `_components/layout/CloudTargetSourceLayout.architecture.test.ts`. Use `\bcloudProvider\b` / `\bawsInstallationMode\b` regex (not bare substring) to avoid comment/import false positives. |
| **Order test** | Add `_components/layout/CloudInstallingStep.test.tsx`. Renders with a mock Azure-installing `CloudTargetSource` and asserts the `installation-status` element appears before `confirmed-resources` in DOM order. See test sketch below the table. The test must mock `AzureInstallationInline` (or the `azure/AzureInstallationInline` module) so the order test does not transitively trigger `useInstallationStatus()` and other mount-time fetches. The data provider is also mocked to a `ready` state. |
| **Lifecycle tests** | Add `_components/data/ConfirmedIntegrationDataProvider.test.tsx`. Cover: mount triggers fetch with abort signal; unmount aborts in-flight; `targetSourceId` change aborts old and refetches; `retry()` aborts in-flight and refetches; `isMissingConfirmedIntegrationError` is normalized to `ready` with empty array. |
| **Routing test** | Add `_components/azure/AzureProjectPage.test.tsx` (or extend the existing test). Assert `<CloudTargetSourceLayout>` mounts when `processStatus === INSTALLING`, and does NOT mount for at least one non-INSTALLING Azure step (e.g. `WAITING_TARGET_CONFIRMATION` per fixture 1005). Mock `CloudTargetSourceLayout` to a sentinel so the test exercises only the routing decision. |

## Implementation Steps

### 1. Data layer (independent, fan-out target)

Author `ConfirmedIntegrationDataProvider`, `useConfirmedIntegration`, and the lifecycle test file. Prefer the existing `app/hooks/useAbortableEffect.ts` helper for the fetch effect — it already centralizes `AbortController` creation, cleanup-time abort, and aborted-error handling. If the helper does not fit (e.g. retry semantics require keeping the controller across renders), document the reason inline in the provider source.

Lifecycle:

1. On mount, create `AbortController`, set `state` to `{ status: 'loading' }`, call `getConfirmedIntegration(targetSourceId, { signal })`.
2. On unmount, abort.
3. On `targetSourceId` change, abort old, reset `state` to `loading`, fetch new.
4. On `retry()`, abort in-flight, refetch (no `targetSourceId` change).
5. Treat `isMissingConfirmedIntegrationError` as `ready` with empty array, matching `ConfirmedIntegrationSection.tsx:49-55`.

The provider must convert the raw BFF response through `confirmedIntegrationToConfirmed` from `@/lib/resource-catalog` before storing it in `state.data`. Do not store the raw BFF shape and do not duplicate mapping logic. The provider's exposed `state.data` type is `readonly ConfirmedResource[]`; lifecycle tests must assert this shape.

Callback identity: if any non-memoized callback is accepted as a prop in the future, store it in a ref following the pattern in `ConfirmedIntegrationSection.tsx:35-40`. Phase 1's provider does not accept such callbacks.

### 2. Layout components (sequential after data layer)

Author in order: `InstallationStatusSlot` → `ConfirmedResourcesSlot` → `AzureInstallationStatus` → `CloudInstallingStep` → `InstallingStep` → `CloudTargetSourceLayout`.

`AzureInstallationStatus` is a pure adapter — it converts `useConfirmedIntegration().state` to the prop shape `AzureInstallationInline` already requires (`confirmed: readonly ConfirmedResource[]`).

### 3. Routing hook (single edit to `AzureProjectPage.tsx`)

Add an early-return for `processStatus === INSTALLING` that returns `<CloudTargetSourceLayout ... />` with all four context props (`identity`, `providerLabel`, `action`, `onProjectUpdate`) computed by the existing `AzureProjectPage` logic. All other steps fall through to the existing render path. Do not touch `AwsProjectPage.tsx` or `GcpProjectPage.tsx`.

### 4. Tests

- R1 source-text test (Phase 1 makes this required green).
- Azure `CloudInstallingStep` DOM-order test.
- `ConfirmedIntegrationDataProvider` lifecycle tests.
- All existing tests must stay green.

### 5. Self-audit, verify, commit, push, PR

Per `/wave-task` Phase 3-6. Phase 3 self-audit (`/sit-recurring-checks` → `/simplify` → `/vercel-react-best-practices`) is required before Phase 4 verify and must not be skipped.

## Subagent Fan-out (per `/wave-task` Subagent Usage)

| Substep | Fan-out target | Constraint |
|---|---|---|
| §1 Data layer | One subagent — independent (no dependency on layout files). | Must include `ConfirmedIntegrationDataProvider.test.tsx` covering all five lifecycle cases. |
| §2 Layout components | Sequential — each layer depends on the next. Do not fan out. | — |
| §3 Routing hook | Sequential after §2. Single file edit; do not fan out. | — |
| §4 Tests | Two subagents in parallel: (a) R1 architecture test, (b) `CloudInstallingStep` DOM-order test. The data-layer test ships with §1. | (a) and (b) live in different files and have no shared state. |

## Guardrails

- **R1**: `CloudTargetSourceLayout.tsx` must not match `\bcloudProvider\b` or `\bawsInstallationMode\b`. Test enforces this.
- **R2**: `InstallationStatusSlot.tsx` and `ConfirmedResourcesSlot.tsx` switch and dispatch only. No `useState` / `useEffect` for business state. No data fetching (the provider does that). `ConfirmedResourcesSlot` may invoke `retry()` from the hook on the error-row button; this is dispatching, not new logic. Slot files target ≤50 lines.
- **R3**: Phase 1 introduces `InstallingStep` (no-op gate) and `CloudInstallingStep` (default body). It does **not** introduce any **override step component** — no `AwsManualInstallingStep`, no `AzureInstallingStep`, no `GcpInstallingStep`. R3 governs override components, not the gate; a stub override that does not change card order would violate R3. The override body arrives in Phase 2 only if AWS Manual genuinely needs a different card order; otherwise AWS Manual stays on the default `CloudInstallingStep` and the AWS-specific installation card lives inside `InstallationStatusSlot`.
- **R4**: `ConfirmedIntegrationDataProvider` exposes confirmed-integration data only. Do not add candidate / approved / guide / permission fields.
- **C1**: `CloudTargetSourceLayout` and the new step components must not be imported by `*ProjectPage.tsx` files in a way that surfaces `ConfirmedResource` to the page. The page receives only `CloudTargetSourceLayout` as JSX; the `ConfirmedResource` type is consumed inside the layout subtree.
- Provider pages keep their existing C1 surface (only `CloudTargetSource`, no resource-domain types).
- No raw color classes — use `lib/theme.ts` tokens, including in any new presentation glue.

## Out of Scope (Phase 1)

The following land in later phases. Do **not** implement them in this PR even if convenient:

- `ConnectionTestStep` step component (phase 2 — covers steps 5-7 per ADR-012 Migration Plan §Phase 2).
- `WaitingApprovalStep` and `ApplyingApprovedStep` (phase 3 — approval/applying extraction from `ProcessStatusCard`).
- `WaitingTargetConfirmationStep` (phase 4 — candidate/approved migration).
- `AwsManualInstallingStep` override component (phase 2, and only if AWS Manual genuinely needs a different card order).
- `AwsInstallationStatus`, `GcpInstallationStatus` adapters (phase 2).
- AWS / GCP routing through `CloudTargetSourceLayout` (phase 2).
- Extracting `ApprovalWaitingCard` / `ApprovalApplyingBanner` from `ProcessStatusCard` (phase 3).
- Deleting `ResourceSection.tsx` (phase 4).
- Lint/grep rule against `*ProjectPage.tsx` importing `@/lib/types/resources` (phase 5).

If implementation requires touching anything in this list to keep `tsc` green, stop and report instead of expanding scope.

## Acceptance Criteria

- `/integration/target-sources/1003` renders installation-status card above integration table (manually verified, screenshot in PR description).
- All other target-source URLs render identically to before this PR. Concrete smoke-check fixtures (from `lib/mock-data.ts`):
  - `/integration/target-sources/1008` (AWS `INSTALLING`) — must stay on legacy path; bottom-card regression must persist for AWS until phase 2.
  - `/integration/target-sources/1010` (AWS `WAITING_CONNECTION_TEST`) — legacy path.
  - `/integration/target-sources/1002` (GCP `WAITING_TARGET_CONFIRMATION`) — legacy path.
  - `/integration/target-sources/1005` (Azure `WAITING_TARGET_CONFIRMATION`) — legacy path; only Azure `INSTALLING` switches to the new path.
- R1 architecture test exists and passes.
- Azure `CloudInstallingStep` DOM-order test exists and passes.
- `ConfirmedIntegrationDataProvider` lifecycle tests exist and pass (mount, unmount abort, id-change, retry, missing-integration).
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings introduced.
- `npm run test:run`: all current baseline tests plus the new tests added by this PR are green. Do not pin a hard-coded count.
- `npm run build`: clean.
- `*ProjectPage.tsx` files do not import `@/lib/types/resources` (already true on `main@f1a23b4`; this PR must not regress it).

## Verification Commands

```bash
# Each negative grep is wrapped with `!` so the command exits 0 (success) when
# rg finds zero matches. Without the bang, rg's exit code 1 on no-match would
# fail a strict `set -e` script even though we want pass-on-no-match.

# R1 source-text guard (sanity check before relying on the test):
! rg -nP "\bcloudProvider\b|\bawsInstallationMode\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx

# Provider page resource-type guard (C1 from #371):
! rg -nP "from\s+['\"]@/lib/types/resources['\"]" \
  app/integration/target-sources/\[targetSourceId\]/_components/{aws,azure,gcp}/*ProjectPage.tsx

# Slot purity (R2):
! rg -nE "useState|useEffect" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/{InstallationStatusSlot,ConfirmedResourcesSlot}.tsx

# Confirm override step components are NOT introduced in Phase 1 (R3 guard).
# Search the entire target-source _components subtree, not just layout/, so an
# override file accidentally landed under aws/, azure/, or gcp/ is also caught.
! rg -nP "\b(AwsManualInstallingStep|AzureInstallingStep|GcpInstallingStep)\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/

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
- Files added (with LOC) and the single file modified (`AzureProjectPage.tsx`). `ConfirmedIntegrationSection.tsx` must remain untouched.
- Visual confirmation: before/after screenshot of `/integration/target-sources/1003`
- Test additions: R1 architecture test + Azure order test + lifecycle tests
- `tsc` / `lint` / `test` / `build` results
- Out-of-scope items explicitly listed (per §Out of Scope)

## Why This Phase Lands First

- It directly fixes the user-reported regression that triggered ADR-012.
- It validates the architectural rules (R1-R4) on a single concrete migration before they are applied to the rest of the page.
- It establishes the data provider lifecycle in a real context, which phases 2-4 reuse without re-inventing.
- It is reviewable in one sitting — single provider, single step, narrow file count.
