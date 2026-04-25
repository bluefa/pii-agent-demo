# ADR-012: Target Source Page Layout with Step Components and Slots

## Status

Proposed (2026-04-25)

## Context

The target-source detail page has a recurring layout-regression risk because process-step branching is distributed across four layers.

First, the provider pages own the top-level sequence. AWS renders metadata, `ProcessStatusCard`, `GuideCardContainer`, `ResourceSection`, then `RejectionAlert` in `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx:58-77`. Azure and GCP repeat the same sequence in `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx:78-97` and `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx:42-61`. AWS also has a pre-process installation-mode branch at `AwsProjectPage.tsx:44-53`.

Second, `ProcessStatusCard` owns step-specific inline content that is not obvious from the provider page: the step 1 instruction block at `app/components/features/ProcessStatusCard.tsx:121-144`, `ApprovalWaitingCard` at `ProcessStatusCard.tsx:146-151`, and `ApprovalApplyingBanner` at `ProcessStatusCard.tsx:153-157`. The same component also owns the history tab at `ProcessStatusCard.tsx:163-164`, so process status, history navigation, and step-specific cards are coupled.

Third, `ResourceSection` performs the first resource-area switch by process step. It maps steps 1-2 to `CandidateResourceSection`, step 3 to `ApprovedIntegrationSection`, and steps 4-7 to `ConfirmedIntegrationSection` in `app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection.tsx:21-44`.

Fourth, the resource subsections branch again. `ConfirmedIntegrationSection` fetches confirmed resources at `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationSection.tsx:42-59`, renders the confirmed table first at `ConfirmedIntegrationSection.tsx:68-86`, and then renders `ConfirmedActions` at `ConfirmedIntegrationSection.tsx:88-96`. `ConfirmedActions` contains a step x provider switch: Azure/AWS/GCP installation cards for step 4 at `ConfirmedIntegrationSection.tsx:116-140`, and `ConnectionTestPanel` for steps 5-7 at `ConfirmedIntegrationSection.tsx:141-153`.

PR #371, commit `257db92`, is a concrete failure mode. Its commit message records a C1 architecture finding: `ProjectPage` components imported `ConfirmedResource` and held confirmed arrays in state, violating the guard that provider `ProjectPage` components must not import resource-domain types. The fix moved confirmed-dependent actions into `ConfirmedIntegrationSection`. That satisfied the C1 guard, but it also made the table render before the action slot because `ConfirmedIntegrationSection` returns the table section before `ConfirmedActions` at `ConfirmedIntegrationSection.tsx:68-96`. For the seed scenario `/integration/target-sources/1003`, the mock data is Azure and `ProcessStatus.INSTALLING` in `lib/mock-data.ts:170-182`, so the Azure installation-status card now appears below the integration table instead of above it.

The current tests do not pin this visual order. The page-level test only verifies that `page.tsx` fetches a project and passes it to `ProjectDetail` in `app/integration/target-sources/[targetSourceId]/page.test.ts:31-54`. Existing step 4 tests validate confirmed-integration data availability, not card order, in `lib/__tests__/mock-confirmed-integration-step4.test.ts:89-110`.

This ADR therefore treats the user's diagnosis as the requirements driver: a reviewer should be able to answer "what does process step X look like for provider Y" by reading a named step component, not by tracing four components.

The implementation target remains the existing TypeScript, Next.js 14 App Router, TailwindCSS, desktop-only frontend. This ADR proposes a frontend layout refactor only; it does not change API contracts.

ADR-010 intentionally uses a frontend slot registry for guide CMS placement because it separates fixed guide identity from many-to-one editable content placement (`docs/adr/010-guide-cms-slot-registry.md:32-40`, `docs/adr/010-guide-cms-slot-registry.md:62-68`). ADR-012 diverges from that pattern: target-source page card order is mostly common across providers, with only narrow provider/step exceptions, so a full page-layout registry would be premature.

## Decision

Adopt **Option D: Step Components with Slots**, a refined version of an imperative process-status switch.

The previous registry draft chose explicit `CardId[]` layout declarations. The reviewer rejected that as over-engineered for the current shape of the page: most steps share the same sequence, and only a few provider/step combinations differ. This ADR now chooses the simpler rule:

1. `CloudTargetSourceLayout` owns the process-status switch.
2. Common step order is expressed directly in named step components.
3. Provider-specific content differences live in provider slots such as `InstallationStatusSlot`.
4. Provider-specific step components exist only when the whole card order differs, such as `AwsManualInstallingStep`.
5. Resource-domain types stay below the layout/data/slot boundary so provider `ProjectPage` components keep the C1 guard.
6. If card order keeps getting more complex, introduce a registry later with concrete evidence that JSX step components are no longer enough.

Candidate options considered:

| Option | Decision | Reason |
|---|---|---|
| A. Single-line fragment swap in `ConfirmedIntegrationSection` | Rejected | It fixes only Azure step 4 ordering and leaves the four-layer branching model intact. |
| B. Render-prop / slot pattern in `ConfirmedIntegrationSection` | Rejected | It improves local flexibility but still hides card order inside the confirmed-resource subsection. |
| C. Per-step explicit layout registry | Rejected | It adds registry, `CardId`, and dispatcher indirection before the page has enough layout variability to justify it. |
| D. Step Components with Slots | Chosen | It makes screen order readable as JSX, keeps common steps deduplicated, and isolates provider exceptions. |
| E. Server-driven layout descriptor | Rejected | It moves a UI-only layout concern into the API contract without removing frontend component mapping. |

## Detailed Design

### Component Ownership

Provider pages become thin wrappers that build provider identity metadata and call `CloudTargetSourceLayout`. They may keep provider-specific identity fallback logic such as Azure settings lookup in `AzureProjectPage.tsx:31-58`, but they should not own process-step card order.

`ProjectPageMeta` is the standardized metadata component name in this repository. The reviewer examples used `ProjectMeta` as a conceptual name, but the actual component imported by all three provider pages is `ProjectPageMeta` (`AwsProjectPage.tsx:10-15`, `AzureProjectPage.tsx:14-19`, `GcpProjectPage.tsx:9-14`).

The top-level layout is a direct process-status switch:

```tsx
const CloudTargetSourceLayout = ({ project }) => {
  switch (project.processStatus) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return <WaitingTargetConfirmationStep project={project} />;
    case ProcessStatus.WAITING_APPROVAL:
      return <WaitingApprovalStep project={project} />;
    case ProcessStatus.APPLYING_APPROVED:
      return <ApplyingApprovedStep project={project} />;
    case ProcessStatus.INSTALLING:
      return <InstallingStep project={project} />;
    case ProcessStatus.WAITING_CONNECTION_TEST:
    case ProcessStatus.CONNECTION_VERIFIED:
    case ProcessStatus.INSTALLATION_COMPLETE:
      return <ConnectionTestStep project={project} />;
  }
};
```

The initial component set is seven step components: `WaitingTargetConfirmationStep`, `WaitingApprovalStep`, `ApplyingApprovedStep`, `InstallingStep`, `ConnectionTestStep`, `CloudInstallingStep`, and `AwsManualInstallingStep`. `InstallingStep` is the override gate; `CloudInstallingStep` is the default shared installing body.

Most steps are plain common JSX. For example:

```tsx
const WaitingApprovalStep = ({ project }) => (
  <>
    <ProjectPageMeta project={project} />
    <ProcessStatusCard project={project} />
    <ApprovalWaitingCard project={project} />
    <GuideCard project={project} />
    <CandidateResourceSection project={project} />
    <RejectionAlert project={project} />
  </>
);
```

This moves `ApprovalWaitingCard` out of `ProcessStatusCard`, where it currently renders only as a nested step branch at `app/components/features/ProcessStatusCard.tsx:146-151`. The same extraction applies to `ApprovalApplyingBanner` at `ProcessStatusCard.tsx:153-157`.

### Provider-Specific Overrides

Do not split every provider into a separate installing step by default. That duplicates the common order. The preferred default is common step order plus provider-specific slots:

```tsx
const CloudInstallingStep = ({ project }) => (
  <TargetSourcePageDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta project={project} />
    <ProcessStatusCard project={project} />
    <GuideCard project={project} />
    <InstallationStatusSlot project={project} />
    <ConfirmedResourcesSlot project={project} />
    <RejectionAlert project={project} />
  </TargetSourcePageDataProvider>
);

const InstallationStatusSlot = ({ project }) => {
  switch (project.cloudProvider) {
    case 'AWS': return <AwsInstallationStatus project={project} />;
    case 'Azure': return <AzureInstallationStatus project={project} />;
    case 'GCP': return <GcpInstallationStatus project={project} />;
  }
};
```

This is the balance the reviewer recommended: common order is readable in one step component, while provider-specific content lives in a narrow slot. It fixes the Azure `INSTALLING` ordering problem because `InstallationStatusSlot` appears before `ConfirmedResourcesSlot` in `CloudInstallingStep`.

Provider-specific step overrides are reserved for cases where the order itself changes. For example:

```tsx
const InstallingStep = ({ project }) => {
  if (project.cloudProvider === 'AWS' && project.awsInstallationMode === 'MANUAL') {
    return <AwsManualInstallingStep project={project} />;
  }
  return <CloudInstallingStep project={project} />;
};
```

AWS without `awsInstallationMode` remains a pre-process case, as it is today in `AwsProjectPage.tsx:44-53`. It should stay outside the seven `ProcessStatus` step layouts unless the product decides it belongs in the process model.

### Data Fetching Decoupling

The key data problem remains confirmed-integration data. Today, `ConfirmedIntegrationSection` owns the fetch and passes `confirmed[]` to its child actions. If `InstallationStatusSlot`, `ConfirmedResourcesSlot`, and later connection-test content become siblings, the data must be shared without pushing `ConfirmedResource` back into provider pages.

`TargetSourcePageDataProvider` is page-scoped but mounted only by step components that need confirmed data, starting with `CloudInstallingStep`. It fetches on mount of the wrapping step component. It also refetches when `targetSourceId` changes.

The provider uses the existing cancellable API shape: `getConfirmedIntegration(targetSourceId, { signal })` accepts `AbortSignal` at `app/lib/api/index.ts:335-344`. Its lifecycle requirements are:

1. On mount, create an `AbortController`, set confirmed state to loading, and call `getConfirmedIntegration`.
2. On unmount, abort the in-flight request.
3. On `targetSourceId` change, abort the old request, reset confirmed state to loading, and fetch the new target source.
4. On manual retry, abort any in-flight request before starting the replacement fetch.
5. Treat missing confirmed integration the same way `ConfirmedIntegrationSection` does today: ready with an empty array instead of an error (`ConfirmedIntegrationSection.tsx:49-55`).

Callback identity must not re-trigger the fetch effect. If the provider accepts callbacks such as project refresh handlers, it stores them in refs and updates the refs in a small effect, following the existing pattern in `ConfirmedIntegrationSection.tsx:35-40`. Fetch effects depend on `targetSourceId` and retry state, not on non-memoized parent callbacks.

The provider exposes a typed hook:

```tsx
export const useConfirmed = (): AsyncState<readonly ConfirmedResource[]> => {
  // Read from TargetSourcePageDataProvider context.
};
```

`AsyncState` is the existing local state shape in `app/integration/target-sources/[targetSourceId]/_components/shared/async-state.ts:1-4`. `ConfirmedResource` stays under the data/slot/resource layer; it is already a resource-domain type imported by `ConfirmedIntegrationSection` at `ConfirmedIntegrationSection.tsx:13-14`. `AzureInstallationInline` needs `confirmed: readonly ConfirmedResource[]` at `app/components/features/process-status/azure/AzureInstallationInline.tsx:38-42`, and `ConnectionTestPanel` needs the same shape at `app/components/features/process-status/ConnectionTestPanel.tsx:28-33`.

### C1 Guard

The C1 guard is preserved by the layering:

- Provider pages import page-level types such as `CloudTargetSource`, as they do today in `AwsProjectPage.tsx:4`, `AzureProjectPage.tsx:4`, and `GcpProjectPage.tsx:4`.
- Resource-domain types stay under the data provider, slots, and resource-specific components. `ConfirmedResource` is currently consumed by `ConfirmedIntegrationSection` at `ConfirmedIntegrationSection.tsx:13-14`, and should not move back into provider `ProjectPage` components.
- `CloudTargetSourceLayout` and step components pass `project`, `refreshProject`, and update callbacks downward. They do not expose `confirmed`, `approved`, or `candidate` arrays to provider pages.
- `ProjectDetail` can continue to dispatch only by provider at `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx:17-25`.

### Test Strategy

The old registry-exhaustiveness test is removed. The new tests assert render order per step component with Vitest and Testing Library.

Preferred assertions use `getAllByRole('region')` when the rendered cards already have accessible regions. If the card components do not expose stable region names yet, tests may use `data-testid` on the step-level wrappers. The test should mock child cards enough to isolate layout order; it should not depend on real API calls.

Concrete Azure `InstallingStep` example:

```tsx
it('renders Azure installation status before confirmed resources', () => {
  render(<InstallingStep project={azureInstallingProject} />);

  const regions = screen.getAllByRole('region');
  const ids = regions.map((region) => region.getAttribute('data-testid'));

  expect(ids.indexOf('installation-status')).toBeLessThan(
    ids.indexOf('confirmed-resources'),
  );
});
```

The proof-of-concept test should cover `/integration/target-sources/1003` behavior because that seed is Azure `INSTALLING` in `lib/mock-data.ts:170-182`.

### Edge Cases

`RejectionAlert` remains explicit in every step component and continues to return `null` when the project is not rejected, as it does at `app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx:8-10`. Keeping it in every step pins its relative position even though rejection is orthogonal to process step.

The history tab stays inside the process-status card. It is not a process-step card; it is a tab within the status frame, currently rendered by `ProjectHistoryPanel` at `ProcessStatusCard.tsx:163-164`.

IDC and SDU are not active `CloudProvider` values in the current TypeScript contract: `CloudProvider` is `AWS | Azure | GCP` in `lib/types.ts:21-23`, and `ProjectDetail` renders an unsupported-provider error for anything else at `ProjectDetail.tsx:24-25`. Their process models are also different: IDC has no approval or scan flow in `docs/cloud-provider-states.md:191-208`, and SDU has a separate state machine in `docs/cloud-provider-states.md:216-249`. This ADR should not force IDC/SDU into the seven-step cloud layout. If the type widens later, `CloudTargetSourceLayout` must fail explicitly until IDC/SDU step components are designed.

## Migration Plan

1. **Phase 1: Azure `INSTALLING` proof of concept.** Add `CloudTargetSourceLayout` and the seven step components alongside existing code. Route only Azure `INSTALLING` through the new path as the visible-value PR. This fixes `/integration/target-sources/1003` by rendering installation status before confirmed resources. Effort: medium.

2. **Phase 2: Remaining confirmed-data steps.** Migrate AWS/GCP `INSTALLING` and steps 5-7 into their step components. At the end of this phase, step 4 and connection-test flows no longer depend on `ConfirmedIntegrationSection` owning action placement. Effort: medium.

3. **Phase 3: Approval/applying extraction.** Move approval and applying cards out of `ProcessStatusCard` into `WaitingApprovalStep` and `ApplyingApprovedStep`. Keep the process-status/history frame intact. Effort: medium.

4. **Phase 4: Candidate/approved migration.** Migrate steps 1-3 resource placement into `WaitingTargetConfirmationStep`, `WaitingApprovalStep`, and `ApplyingApprovedStep`. Delete `ResourceSection.tsx` after no render path imports it. Effort: medium.

5. **Phase 5: Cleanup and boundary lock.** Remove dead branches in `ProcessStatusCard` and `ConfirmedIntegrationSection`. Add a lint or grep rule that prevents `*ProjectPage.tsx` files from importing `@/lib/types/resources`. Effort: low.

Every phase is independently testable with `npm run test:run`. Phases that change component imports or JSX should also run `npm run lint`; phases that touch route/data contracts should run `npm run build`.

## Consequences

### Positive

- Screen order is readable as JSX in named step components.
- Most steps remain common, so provider duplication stays low.
- Provider pages become thin: they build provider metadata and delegate layout.
- Provider-specific content differences are isolated to slots such as `InstallationStatusSlot`.
- Provider-specific order differences are isolated to explicit override components such as `AwsManualInstallingStep`.
- Resource-domain types stay below the data/slot layer, preserving the C1 guard.
- The Azure step 4 failure mode is structurally prevented because `CloudInstallingStep` renders `InstallationStatusSlot` before `ConfirmedResourcesSlot`.

### Negative / Trade-offs

- Comparing AWS manual `INSTALLING` and Azure `INSTALLING` in a table is harder than with a registry. The accepted trade-off is that developers usually read JSX to understand screen order.
- If every provider starts diverging in multiple steps, step components may accumulate duplication. That is the point where a registry can be reconsidered.
- During migration, old and new render paths coexist. That temporarily increases the chance that a fix lands in only one path.
- `ProcessStatusCard` cleanup may require small visual adjustments because step-specific content currently lives inside its card chrome.

### What This Does Not Solve

- It does not prove pixel-perfect rendering. Without browser screenshot baselines, the step components protect order, not spacing or detailed visual chrome.
- It does not solve provider-specific installation-status correctness. AWS, Azure, and GCP installation components still own their own status logic.
- It does not change the BFF process-status model from ADR-009 or the approval object model from ADR-006.
- It does not define IDC/SDU layouts.

### Effort Estimate

| Phase | Effort |
|---|---|
| Phase 1: Azure `INSTALLING` proof of concept | Medium |
| Phase 2: AWS/GCP `INSTALLING` and steps 5-7 | Medium |
| Phase 3: Approval/applying extraction | Medium |
| Phase 4: Steps 1-3 and `ResourceSection` removal | Medium |
| Phase 5: Cleanup and boundary lock | Low |

## Alternatives Considered

### A. Single-Line Fragment Swap in `ConfirmedIntegrationSection`

This would move `ConfirmedActions` above the confirmed table for step 4. It is the cheapest immediate fix, but it keeps the root cause: the final order for a provider x step still emerges from provider pages, `ProcessStatusCard`, `ResourceSection`, and subsection internals. It also risks changing steps 5-7 unless extra conditions are added. Rejected.

### B. Render-Prop / Slot Pattern in `ConfirmedIntegrationSection`

`ConfirmedIntegrationSection` could accept render props such as `renderBeforeTable` or `renderActions`. This would let the caller place Azure installation status above the table while reusing the confirmed fetch. It still makes the confirmed-resource subsection the owner of page-level layout and would either pull resource-domain callbacks toward provider pages or create custom slots only for confirmed states. Rejected.

### C. Per-Step Explicit Layout Registry

A registry with `CardId[]` arrays would create a single inspectable matrix for provider x step order. That was the previous draft's chosen option.

It is now rejected as premature. The reviewer clarified that the current condition is "most step compositions are similar, and only some provider/step cases are exceptions." In that shape, a full registry adds `CardId`, dispatcher, enabled-card calculation, and exhaustive key tests before the page has enough variability to need them. CLAUDE.md section 2 says: "Minimum code that solves the problem. Nothing speculative" and "No abstractions for single-use code" (`CLAUDE.md:18-23`). The registry violates that guidance for this specific problem.

This does not contradict ADR-010. ADR-010 chose a slot registry for guide CMS because guide identity, placement, and editable content have a many-to-one relationship (`docs/adr/010-guide-cms-slot-registry.md:32-40`). ADR-012 is about page card order, where JSX step components are the simpler artifact.

### D. Step Components with Slots

A single `CloudTargetSourceLayout` switches on `ProcessStatus` and returns named step components. The step components render common order directly. Provider-specific slots handle differences in internal content, and provider-specific step components handle only full-order overrides.

This is chosen because it solves the Azure `INSTALLING` order regression, keeps the C1 guard, and gives reviewers an obvious place to read page order without adding a registry layer.

### E. Server-Driven Layout Descriptor

The BFF could return a layout descriptor with card IDs. This is unnecessary for the current problem. The server owns process-state calculation per ADR-009, but the frontend owns visual placement. Moving card order into the BFF would add API contract surface for a UI-only concern and would not remove the need for frontend component mapping. Rejected.

## Open Questions

1. Should the first baseline be a DOM-order test using mocked slots, or should the project add browser screenshot tooling for the target-source page?
2. Should `CloudInstallingStep` be the default and provider-specific overrides be additive, or should each provider have its own `InstallingStep` with `CloudInstallingStep` as a shared body?
