# ADR-012: Target Source Page Layout Registry

## Status

Proposed (2026-04-25)

## Context

The target-source detail page has a recurring layout-regression risk because process-step branching is distributed across four layers.

First, the provider pages own the top-level sequence. AWS renders metadata, `ProcessStatusCard`, `GuideCard`, `ResourceSection`, then `RejectionAlert` in `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx:55-78`. Azure and GCP repeat the same sequence in `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx:75-97` and `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx:39-61`. AWS also has a pre-process installation-mode branch at `AwsProjectPage.tsx:43-52`.

Second, `ProcessStatusCard` owns step-specific inline content that is not obvious from the provider page: the step 1 instruction block at `app/components/features/ProcessStatusCard.tsx:121-144`, `ApprovalWaitingCard` at `ProcessStatusCard.tsx:146-151`, and `ApprovalApplyingBanner` at `ProcessStatusCard.tsx:153-157`. The same component also owns the history tab at `ProcessStatusCard.tsx:163-164`, so process status, history navigation, and step-specific cards are coupled.

Third, `ResourceSection` performs the first resource-area switch by process step. It maps steps 1-2 to `CandidateResourceSection`, step 3 to `ApprovedIntegrationSection`, and steps 4-7 to `ConfirmedIntegrationSection` in `app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection.tsx:21-44`.

Fourth, the resource subsections branch again. `ConfirmedIntegrationSection` fetches confirmed resources at `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationSection.tsx:42-59`, renders the confirmed table first at `ConfirmedIntegrationSection.tsx:68-86`, and then renders `ConfirmedActions` at `ConfirmedIntegrationSection.tsx:88-96`. `ConfirmedActions` contains a step x provider switch: Azure/AWS/GCP installation cards for step 4 at `ConfirmedIntegrationSection.tsx:116-140`, and `ConnectionTestPanel` for steps 5-7 at `ConfirmedIntegrationSection.tsx:141-153`.

PR #371, commit `257db92`, is a concrete failure mode. Its commit message records a C1 architecture finding: `ProjectPage` components imported `ConfirmedResource` and held confirmed arrays in state, violating the guard that provider `ProjectPage` components must not import resource-domain types. The fix moved confirmed-dependent actions into `ConfirmedIntegrationSection`. That satisfied the C1 guard, but it also made the table render before the action slot because `ConfirmedIntegrationSection` returns the table section before `ConfirmedActions` at `ConfirmedIntegrationSection.tsx:68-96`. For the seed scenario `/integration/target-sources/1003`, the mock data is Azure and `ProcessStatus.INSTALLING` in `lib/mock-data.ts:170-182`, so the Azure installation-status card now appears below the integration table instead of above it.

The current tests do not pin this visual order. The page-level test only verifies that `page.tsx` fetches a project and passes it to `ProjectDetail` in `app/integration/target-sources/[targetSourceId]/page.test.ts:31-54`. Existing step 4 tests validate confirmed-integration data availability, not card order, in `lib/__tests__/mock-confirmed-integration-step4.test.ts:89-110`.

This ADR therefore treats the user's diagnosis as the requirements driver: a reviewer should be able to answer "what does process step X look like for provider Y" by reading one layout declaration, not by tracing four components.

The implementation target remains the existing TypeScript, Next.js App Router, TailwindCSS, desktop-only frontend. This ADR proposes a frontend layout refactor only; it does not change API contracts.

## Decision

Adopt **Option C: per-step explicit layout declaration**.

This ADR makes six major decisions:

1. Add a target-source layout registry where each active provider variant and each `ProcessStatus` value explicitly declares an ordered `readonly CardId[]`.
2. Add a `CardSlot` dispatcher that maps `CardId` to the existing card components.
3. Move step-specific cards out of `ProcessStatusCard`; keep the status/history frame as a card slot, but do not let it own process-step branching.
4. Introduce a page-scoped confirmed-integration data provider so sibling slots such as `installationStatus` and `confirmedResources` can share one fetch without leaking resource-domain types to provider pages.
5. Keep the C1 guard: provider `ProjectPage` components pass primitive/page-level context only and do not import `ConfirmedResource`, `ApprovedResource`, `CandidateResource`, or other resource-domain types.
6. Add layout-sequence tests before or with each migration slice so the intended order is reviewable.

Candidate options considered:

| Option | Decision | Reason |
|---|---|---|
| A. Single-line fragment swap in `ConfirmedIntegrationSection` | Rejected | It fixes only Azure step 4 ordering and leaves the four-layer branching model intact. |
| B. Render-prop / slot pattern in `ConfirmedIntegrationSection` | Rejected | It improves local flexibility but still hides card order inside the confirmed-resource subsection. |
| C. Per-step explicit layout declaration | Chosen | It creates the requested single source of truth for provider x step card order and makes order testable. |
| D. Imperative `TargetSourceProcessLayout` switch | Rejected | A single switch is better than today's sprawl, but declarative arrays are easier to snapshot, diff, and exhaustively type-check. |

## Detailed Design

### Single Source of Truth

Add the registry under the target-source detail tree:

```typescript
// app/integration/target-sources/[targetSourceId]/_components/layout/target-source-layout-registry.ts
import { ProcessStatus, type AwsInstallationMode, type CloudProvider } from '@/lib/types';

export type TargetSourceLayoutVariant =
  | 'aws.auto'
  | 'aws.manual'
  | 'azure'
  | 'gcp';

export type CardId =
  | 'projectMeta'
  | 'awsInstallationModeSelector'
  | 'processStatus'
  | 'targetSelectionInstruction'
  | 'approvalWaiting'
  | 'approvalApplying'
  | 'guide'
  | 'candidateResources'
  | 'approvedResources'
  | 'installationStatus'
  | 'confirmedResources'
  | 'connectionTest'
  | 'rejectionAlert';

export type TargetSourceStepLayouts = Record<
  TargetSourceLayoutVariant,
  Record<ProcessStatus, readonly CardId[]>
>;

export const TARGET_SOURCE_STEP_LAYOUTS = {
  'aws.auto': {
    [ProcessStatus.WAITING_TARGET_CONFIRMATION]: ['projectMeta', 'processStatus', 'targetSelectionInstruction', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_APPROVAL]: ['projectMeta', 'processStatus', 'approvalWaiting', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.APPLYING_APPROVED]: ['projectMeta', 'processStatus', 'approvalApplying', 'guide', 'approvedResources', 'rejectionAlert'],
    [ProcessStatus.INSTALLING]: ['projectMeta', 'processStatus', 'guide', 'installationStatus', 'confirmedResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_CONNECTION_TEST]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.CONNECTION_VERIFIED]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.INSTALLATION_COMPLETE]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
  },
  'aws.manual': {
    [ProcessStatus.WAITING_TARGET_CONFIRMATION]: ['projectMeta', 'processStatus', 'targetSelectionInstruction', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_APPROVAL]: ['projectMeta', 'processStatus', 'approvalWaiting', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.APPLYING_APPROVED]: ['projectMeta', 'processStatus', 'approvalApplying', 'guide', 'approvedResources', 'rejectionAlert'],
    [ProcessStatus.INSTALLING]: ['projectMeta', 'processStatus', 'guide', 'installationStatus', 'confirmedResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_CONNECTION_TEST]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.CONNECTION_VERIFIED]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.INSTALLATION_COMPLETE]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
  },
  azure: {
    [ProcessStatus.WAITING_TARGET_CONFIRMATION]: ['projectMeta', 'processStatus', 'targetSelectionInstruction', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_APPROVAL]: ['projectMeta', 'processStatus', 'approvalWaiting', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.APPLYING_APPROVED]: ['projectMeta', 'processStatus', 'approvalApplying', 'guide', 'approvedResources', 'rejectionAlert'],
    [ProcessStatus.INSTALLING]: ['projectMeta', 'processStatus', 'guide', 'installationStatus', 'confirmedResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_CONNECTION_TEST]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.CONNECTION_VERIFIED]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.INSTALLATION_COMPLETE]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
  },
  gcp: {
    [ProcessStatus.WAITING_TARGET_CONFIRMATION]: ['projectMeta', 'processStatus', 'targetSelectionInstruction', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_APPROVAL]: ['projectMeta', 'processStatus', 'approvalWaiting', 'guide', 'candidateResources', 'rejectionAlert'],
    [ProcessStatus.APPLYING_APPROVED]: ['projectMeta', 'processStatus', 'approvalApplying', 'guide', 'approvedResources', 'rejectionAlert'],
    [ProcessStatus.INSTALLING]: ['projectMeta', 'processStatus', 'guide', 'installationStatus', 'confirmedResources', 'rejectionAlert'],
    [ProcessStatus.WAITING_CONNECTION_TEST]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.CONNECTION_VERIFIED]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
    [ProcessStatus.INSTALLATION_COMPLETE]: ['projectMeta', 'processStatus', 'guide', 'confirmedResources', 'connectionTest', 'rejectionAlert'],
  },
} as const satisfies TargetSourceStepLayouts;

export const resolveTargetSourceLayoutVariant = (
  provider: CloudProvider,
  awsInstallationMode?: AwsInstallationMode,
): TargetSourceLayoutVariant | 'aws.installationModeRequired' => {
  if (provider === 'AWS') {
    if (!awsInstallationMode) return 'aws.installationModeRequired';
    return awsInstallationMode === 'MANUAL' ? 'aws.manual' : 'aws.auto';
  }
  if (provider === 'Azure') return 'azure';
  return 'gcp';
};
```

The final implementation should not use spread helpers that obscure the final arrays. It may reuse constants for labels or tests, but the reviewed file must show the final card sequence for every active provider variant and every `ProcessStatus`.

### CardSlot Dispatcher

Add a dispatcher near the registry, not inside provider pages:

```typescript
// app/integration/target-sources/[targetSourceId]/_components/layout/CardSlot.tsx
import type { CloudTargetSource } from '@/lib/types';
import type { CardId } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/target-source-layout-registry';

export interface CardSlotProps {
  id: CardId;
  project: CloudTargetSource;
  refreshProject: () => Promise<void>;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const CardSlot = (props: CardSlotProps) => {
  switch (props.id) {
    case 'processStatus':
      return <ProcessStatusCard project={props.project} onProjectUpdate={props.onProjectUpdate} />;
    case 'guide':
      return <GuideCard currentStep={props.project.processStatus} provider={props.project.cloudProvider} installationMode={props.project.awsInstallationMode} />;
    case 'installationStatus':
      return <InstallationStatusSlot targetSourceId={props.project.targetSourceId} provider={props.project.cloudProvider} refreshProject={props.refreshProject} />;
    case 'confirmedResources':
      return <ConfirmedResourcesSlot />;
    case 'connectionTest':
      return <ConnectionTestSlot targetSourceId={props.project.targetSourceId} refreshProject={props.refreshProject} />;
    default:
      return null;
  }
};
```

Provider pages should become thin wrappers that build identity metadata and call a shared `TargetSourcePageLayout`. They may keep provider-specific identity fallback logic such as Azure settings lookup in `AzureProjectPage.tsx:32-58`, but they should not own process-step card order.

### Data Fetching Decoupling

The key design problem is confirmed-integration data. Today, `ConfirmedIntegrationSection` owns the fetch and passes `confirmed[]` to its child actions. If `installationStatus`, `confirmedResources`, and `connectionTest` become sibling slots, the data must be shared without pushing resource types back into provider pages.

Options:

1. **Each card fetches independently.** This is simple, and the existing API helper already supports cancellation via `getConfirmedIntegration(targetSourceId, { signal })` in `app/lib/api/index.ts:335-344`. The cost is duplicate calls for the same page state. Azure step 4 would fetch confirmed resources once for `AzureInstallationInline` and again for the confirmed table; steps 5-7 would fetch once for the table and once for `ConnectionTestPanel`. The repo does not currently have SWR or React Query dependencies in `package.json:13-22`, so duplicate-card fetches would not be deduped by infrastructure.

2. **Page-level data provider/context owns the fetch.** A client provider inside `TargetSourcePageLayout` owns the confirmed-integration `AsyncState`, uses the same AbortController pattern as `ConfirmedIntegrationSection.tsx:42-59`, and exposes typed hooks to resource slots. Provider pages still do not import resource-domain types because the provider and slots live below the layout boundary.

3. **Custom hooks-based shared cache.** A new `useConfirmedIntegrationCache(targetSourceId)` hook could maintain a module-level map. The repo's existing hooks are local-state wrappers, not shared data caches: `useInstallationStatus` stores local status at `app/hooks/useInstallationStatus.ts:26-70`, `useAsync` is local loading/error state at `app/hooks/useAsync.ts:17-52`, and `useGuide` fetches and refreshes one guide with local state at `app/hooks/useGuide.ts:35-79`. A custom cache would introduce new invalidation semantics for a single page problem.

Choose option 2.

Add a page-scoped provider:

```typescript
// app/integration/target-sources/[targetSourceId]/_components/layout/TargetSourcePageDataContext.tsx
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';

export interface TargetSourcePageData {
  confirmed: AsyncState<readonly ConfirmedResource[]>;
  refreshConfirmed: () => void;
}

export const TargetSourcePageDataProvider = ({
  targetSourceId,
  enabledCards,
  children,
}: {
  targetSourceId: number;
  enabledCards: readonly CardId[];
  children: React.ReactNode;
}) => {
  // Fetch confirmed integration only when enabledCards contains a confirmed-data consumer.
};
```

`ConfirmedResourcesSlot`, `InstallationStatusSlot` for Azure, and `ConnectionTestSlot` consume `useTargetSourcePageData()`. AWS and GCP installation slots do not need confirmed resources today, but they can share the same slot ID because the provider-specific dispatcher determines which component to render. `AzureInstallationInline` currently requires `confirmed` in `app/components/features/process-status/azure/AzureInstallationInline.tsx:38-42`; `ConnectionTestPanel` requires it in `app/components/features/process-status/ConnectionTestPanel.tsx:28-33`.

### C1 Guard

The C1 guard is preserved by the layering:

- Provider pages import page-level types such as `CloudTargetSource`, as they do today in `AwsProjectPage.tsx:4`, `AzureProjectPage.tsx:4`, and `GcpProjectPage.tsx:4`.
- Resource-domain types stay under the layout/data/slot layer. `ConfirmedResource` is currently defined in `lib/types/resources/confirmed.ts:3-14` and should only be imported by resource slots, the data provider, and resource-specific components.
- `CardSlotProps` passes `project`, `refreshProject`, and `onProjectUpdate`; it does not expose `confirmed`, `approved`, or `candidate` arrays to provider pages.
- `ProjectDetail` can continue to dispatch only by provider at `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx:17-25`.

### Edge Cases

`RejectionAlert` remains an explicit slot in every step layout and continues to return `null` when the project is not rejected, as it does at `app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx:8-10`. Keeping it in every array pins its relative position even though rejection is orthogonal to process step.

The history tab stays inside the process-status card. It is not a process-step card; it is a tab within the status frame, currently rendered by `ProjectHistoryPanel` at `ProcessStatusCard.tsx:163-164`.

AWS without `awsInstallationMode` remains a pre-process layout variant. The current early return in `AwsProjectPage.tsx:43-52` should move into the registry as `aws.installationModeRequired` or into `TargetSourcePageLayout` before resolving process-step layouts. It should not be folded into one of the seven `ProcessStatus` layouts.

IDC and SDU are not active `CloudProvider` values in the current TypeScript contract: `CloudProvider` is `AWS | Azure | GCP` in `lib/types.ts:21-23`, and `ProjectDetail` renders an unsupported-provider error for anything else at `ProjectDetail.tsx:24-25`. Their process models are also different: IDC has no approval or scan flow in `docs/cloud-provider-states.md:191-208`, and SDU has a separate state machine in `docs/cloud-provider-states.md:216-249`. This ADR should not force IDC/SDU into the seven-step cloud registry. If the type widens later, the resolver must fail explicitly until an IDC/SDU registry is added.

## Migration Plan

1. **Scaffold registry and tests without changing rendering.** Add `target-source-layout-registry.ts` and unit tests that assert every active provider variant has all seven `ProcessStatus` keys and that Azure `INSTALLING` resolves to `installationStatus` before `confirmedResources`. Effort: low.

2. **Migrate Azure `INSTALLING` as the proof of concept.** Route only Azure step 4 through `TargetSourcePageLayout`, `CardSlot`, and `TargetSourcePageDataProvider`; leave all other steps on the existing path. This is the first visible-value PR because it fixes `/integration/target-sources/1003` by making the installation-status card render above the confirmed table. Effort: medium.

3. **Migrate the remaining confirmed-data steps.** Move AWS/GCP `INSTALLING` and all providers' steps 5-7 to the new `installationStatus`, `confirmedResources`, and `connectionTest` slots. Remove the step x provider action switch from `ConfirmedIntegrationSection` after these paths are migrated. Effort: medium.

4. **Move approval and applying cards out of `ProcessStatusCard`.** Convert the step 1 instruction, step 2 approval-waiting card, and step 3 applying banner into card slots. Keep the process-status/history frame intact. Effort: medium.

5. **Migrate candidate and approved resource sections.** Replace `ResourceSection` for steps 1-3 with direct `candidateResources` and `approvedResources` slots. At the end of this step, `ResourceSection` should be deleted. Effort: medium.

6. **Add broader layout baselines.** Add tests for every provider variant x step sequence. If the project accepts browser-level visual tooling, add a screenshot baseline for the high-risk scenarios; otherwise keep DOM-order baselines using mocked slots. Effort: low to medium depending on tooling.

7. **Cleanup and lock the boundary.** Remove dead branch code from `ProcessStatusCard`, `ConfirmedIntegrationSection`, and provider pages. Add a grep or lint rule that prevents provider `ProjectPage` components from importing `@/lib/types/resources`. Effort: low.

Every phase is independently testable with `npm run test:run`. Phases that change component imports or JSX should also run `npm run lint`; phases that touch route/data contracts should run `npm run build`.

## Consequences

### Positive

- The intended card order for each active provider and step is reviewable in one file.
- The Azure step 4 failure mode is structurally prevented because `installationStatus` and `confirmedResources` are sibling slots whose order is declared by the registry.
- The C1 guard remains intact: provider pages do not need resource-domain types to arrange resource-domain cards.
- Layout-order tests become cheap and targeted. A future refactor that moves `installationStatus` below `confirmedResources` changes a small array diff and fails a registry test.
- The approach mirrors the existing Guide CMS slot-registry direction: `GUIDE_SLOTS` already centralizes guide placement in `lib/constants/guide-registry.ts:17-162`, and `resolveStepSlot` already normalizes provider/step input at `app/components/features/process-status/GuideCard/resolve-step-slot.ts:18-41`.

### Negative / Trade-offs

- The registry adds indirection. A developer must learn `CardId` and the dispatcher before following JSX to the final component.
- Provider-specific exceptions can become noisy if arrays are copied for every provider variant. This is intentional for reviewability, but it increases maintenance surface.
- The page-scoped data provider introduces context lifecycle rules. Incorrect `enabledCards` handling could skip a required fetch or fetch stale data after a step transition.
- During migration, old and new render paths coexist. That temporarily increases the chance that a fix lands in only one path.
- `ProcessStatusCard` cleanup may require small visual adjustments because step-specific content currently lives inside its card chrome.

### What This Does Not Solve

- It does not prove pixel-perfect rendering. Without browser screenshot baselines, the registry protects order, not spacing or detailed visual chrome.
- It does not solve provider-specific installation-status correctness. AWS, Azure, and GCP installation components still own their own status logic.
- It does not change the BFF process-status model from ADR-009 or the approval object model from ADR-006.
- It does not define IDC/SDU layouts.

### Effort Estimate

| Phase | Effort |
|---|---|
| Registry scaffold and tests | Low |
| Azure `INSTALLING` proof of concept | Medium |
| Remaining confirmed-data steps | Medium |
| ProcessStatusCard branch extraction | Medium |
| Candidate/approved migration and `ResourceSection` removal | Medium |
| Baseline tests and boundary lock | Low to medium |

## Alternatives Considered

### A. Single-Line Fragment Swap in `ConfirmedIntegrationSection`

This would move `ConfirmedActions` above the confirmed table for step 4. It is the cheapest immediate fix, but it keeps the root cause: the final order for a provider x step still emerges from provider pages, `ProcessStatusCard`, `ResourceSection`, and subsection internals. It also risks changing steps 5-7 unless extra conditions are added. Rejected.

### B. Render-Prop / Slot Pattern in `ConfirmedIntegrationSection`

`ConfirmedIntegrationSection` could accept render props such as `renderBeforeTable` or `renderActions`. This would let the caller place Azure installation status above the table while reusing the confirmed fetch. It still makes the confirmed-resource subsection the owner of page-level layout and would either pull resource-domain callbacks toward provider pages or create custom slots only for confirmed states. Rejected.

### D. Imperative `TargetSourceProcessLayout` Switch

A single component could switch on `ProcessStatus` and return JSX for each step. This would centralize the branching and may be simpler for a small component. It is less suitable here because provider variants and card order are the artifact we want reviewers and tests to inspect. Declarative arrays are easier to snapshot, diff, and check exhaustively with `satisfies Record<...>`. Rejected in favor of Option C.

### E. Server-Driven Layout Descriptor

The BFF could return a layout descriptor with card IDs. This is unnecessary for the current problem. The server owns process-state calculation per ADR-009, but the frontend owns visual placement. Moving card order into the BFF would add API contract surface for a UI-only concern and would not remove the need for frontend component mapping. Rejected.

## Open Questions

1. Should the first baseline be a DOM-order test using mocked slots, or should the project add browser screenshot tooling for the target-source page?
2. Should `ProcessStatusCard` keep the step 1 instruction inside its visual chrome, or should that instruction become a separate top-level card slot even if spacing changes slightly?
3. Should `approvedResources` also move into the page-scoped data provider now, or only after a second sibling slot needs approved-integration data?
4. Should `aws.installationModeRequired` live in the same registry file or remain a pre-layout guard because it is not one of the seven `ProcessStatus` values?
5. If IDC/SDU become active in `CloudProvider`, should they get separate registries or a generalized layout registry with provider-specific state enums?
