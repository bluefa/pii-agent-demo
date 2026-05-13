# Wave 10 — Step 4 (INSTALLING) polish

## Context

Wave 10 polishes the `INSTALLING` step (`ProcessStatus.INSTALLING`, screen-4
Step 4 of the prototype) to match `design/SIT Prototype v7 - standalone.html`.
It closes three audit gaps and two Wave 7 (PR #472) deferrals:

1. **Guide Card mount (audit G1).** Six of seven steps render no
   `GuideCardContainer`; Wave 10 covers INSTALLING.
2. **GCP fork decision (audit G5 / §5-1).** `CloudInstallingStep.tsx:49`
   hides `ConfirmedResourcesSlot` for GCP. Audit recommends removing the
   gate unless a code read finds a GCP-specific dependency.
3. **Resource-ID copy-on-hover (audit G2).** `InstallResourceTable` mono IDs
   are plain text today; the prototype reveals a copy button on row hover.
4. **Provider tag (Wave 7 deferred).** PR #472 §3-5 deferred the Provider
   tag because the install card is composed inside provider-specific
   components. Wave 10 mounts it in `CloudInstallingStep`'s page-level
   meta strip — the consistent place across all three providers.
5. **Per-provider status column label (Wave 7 deferred).** PR #472 §3-6
   skipped plumbing `cloudProvider` to `InstallResourceTable`. Wave 10
   adds the prop and switches the label per provider.

Wave 10 **depends on Wave 9** (`feat/sit-step-polish-wave9-foundation`)
being merged to `origin/main`. Wave 10 imports `CopyButton` from
`@/app/components/ui/CopyButton`. Wave 10 does NOT touch ScanPill new
states (no consumer signal yet), does NOT touch Waves 11/12/13 surfaces.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "export const CopyButton" app/components/ui && echo "✓ Wave 9 merged"
```

If the check fails, stop. Wave 10 must follow Wave 9.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave10-step4-installing --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave10-step4-installing
```

Branch name: `feat/sit-step-polish-wave10-step4-installing`.

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — `.provider-badge`
   (16 / 700 / `-0.02em`, 8 px provider-color dot before the label;
   variants: aws `#FF9900`, azure `#0078D4`, gcp `#4285F4`). `.copy-btn`
   row-hover pattern.
2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md` —
   §3 INSTALLING row; §4 D4, D5; §5-1 GCP fork; §8 punch list G1, G2, G5.
3. `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.tsx`
   — current shell; the GCP gate is at line 49.
4. `app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot.tsx`
   — **REQUIRED for the GCP fork decision**. Trace its data
   dependencies; record the finding in the PR body.
5. `app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx`
   — current 5-column shape.
6. `app/components/features/process-status/install-task-pipeline/join-installation-resources.ts`
   — `InstallResourceRow.resourceId` is always a string.
7. `app/components/features/process-status/gcp/GcpInstallationInline.tsx:125`
   — the only call site of `InstallResourceTable` today.
8. `app/components/features/process-status/GuideCard/GuideCardContainer.tsx`
   — confirm the slot key prop name and null-handling.
9. `app/components/ui/CopyButton.tsx` (Wave 9) — confirm the `className`
   seam matches the planned `opacity-0 group-hover:opacity-100`.
10. `app/components/ui/PageMeta.tsx` — reference for the canonical
    row-hover `CopyButton` usage.
11. `lib/theme.ts` — `providerColors.{AWS, Azure, GCP}.bar`, `cardStyles`,
    `textColors`.

## Step 3: Implementation

### 3-1. `CloudInstallingStep` — GuideCard mount + Provider tag + GCP fork

File: `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.tsx`

Three coordinated changes.

#### 3-1-a. Mount `GuideCardContainer`

The component already imports `resolveStepSlot` and computes `slotKey`
(line 32), but the existing call omits the AWS install-mode argument and
the slot is never rendered. Two coordinated edits:

**Edit 1 — pass `awsInstallationMode`.** `resolveStepSlot` (signature in
`app/components/features/process-status/GuideCard/resolve-step-slot.ts`)
takes a third optional argument that branches AWS AUTO vs MANUAL.
`CloudTargetSource.awsInstallationMode` exists in `lib/types.ts:257,283`.
Update the line:

```diff
- const slotKey = resolveStepSlot(project.cloudProvider, ProcessStatus.INSTALLING);
+ const slotKey = resolveStepSlot(
+   project.cloudProvider,
+   ProcessStatus.INSTALLING,
+   project.awsInstallationMode,
+ );
```

**Edit 2 — mount the container with a null guard.** `slotKey` is
`GuideSlotKey | null` but `GuideCardContainer.slotKey` is required
non-null. Mirror the `WaitingTargetConfirmationStep` consumer pattern:

```ts
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
```

In the JSX tree, insert directly below `<ProcessStatusCard ... />`:
```tsx
{slotKey && <GuideCardContainer slotKey={slotKey} />}
```

The guard renders nothing when the registry has no entry for this
(provider, step, mode) tuple — the same behaviour the existing consumer
on `WaitingTargetConfirmationStep` relies on.

#### 3-1-b. Provider tag in the page meta action slot

The `providerLabel` prop is already passed in (line 28). The prototype's
`.provider-badge` is a 16 / 700 / `-0.02em` inline-flex with a coloured
8 px dot before the label. Reuse `providerColors[provider].bar`.

Define the badge inline at the top of the file (small, single-use; not
worth a separate component yet):

```tsx
const PROVIDER_BADGE_CLASS = cn(
  'inline-flex items-center gap-2',
  'text-[16px] font-bold tracking-[-0.02em]',
  textColors.primary,
);

const ProviderBadge = ({
  provider,
  label,
}: { provider: CloudProvider; label: string }) => (
  <span className={PROVIDER_BADGE_CLASS}>
    <span
      className={cn('h-2 w-2 rounded-full', providerColors[provider].bar)}
      aria-hidden="true"
    />
    <span><strong>Provider:</strong> {label}</span>
  </span>
);
```

Imports to add:
```ts
import { cn, providerColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';
```

`ProjectPageMeta` already exposes an `action` slot on the right edge.
Preserve the caller-passed `action` content by combining both in a flex
row (badge to the left of the existing action):

```tsx
<ProjectPageMeta
  project={project}
  providerLabel={providerLabel}
  identity={identity}
  action={
    <div className="flex items-center gap-3">
      <ProviderBadge provider={project.cloudProvider} label={providerLabel} />
      {action}
    </div>
  }
/>
```

`CloudProvider` is title-case (`'Azure'`, `'AWS'`, `'GCP'`, `'IDC'`) and
matches the `providerColors` key set exhaustively — no fallback needed.
Before adopting the snippet, verify `providerColors` in `lib/theme.ts`
covers every `CloudProvider` variant; if a key is missing, add it there
first (this remains a Wave-10-scoped change because it is required by
the install-step consumer).

#### 3-1-c. GCP fork — decision required

Line 49 currently reads:
```tsx
{project.cloudProvider !== 'GCP' && <ConfirmedResourcesSlot />}
```

**Decision procedure** (execute before the edit):

1. Read `ConfirmedResourcesSlot.tsx` end-to-end.
2. Trace `useConfirmedIntegration()` — the data shape is sourced from a
   single BFF `/confirmed` endpoint and is not provider-specific.
3. If no provider-specific assumption is found, **remove the gate**:
   ```tsx
   <ConfirmedResourcesSlot />
   ```
4. If a provider-specific assumption is found (e.g., the slot consumes a
   field that only Azure/AWS populate), **keep the gate** and add a
   single-line comment naming the dependency.

**Default expectation per audit §5-1:** the slot is provider-agnostic
and the gate is removable.

**PR body MUST document the decision and the evidence.** Example lines:
- "Gate removed. `ConfirmedResourcesSlot` consumes `useConfirmedIntegration`
   which is provider-agnostic; no GCP-specific shape involved."
- "Gate kept. `ConfirmedResourcesSlot` reads `<field>` which is only
   populated for Azure/AWS; deferred to a future wave."

#### 3-1-d. Final tree (for reference)

```tsx
<ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
  <ProjectPageMeta
    project={project}
    providerLabel={providerLabel}
    identity={identity}
    action={
      <div className="flex items-center gap-3">
        <ProviderBadge provider={project.cloudProvider} label={providerLabel} />
        {action}
      </div>
    }
  />
  <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
  {slotKey && <GuideCardContainer slotKey={slotKey} />}
  <InstallationStatusSlot project={project} refreshProject={refreshProject} />
  <ConfirmedResourcesSlot />   {/* if gate removed; otherwise keep conditional */}
  <RejectionAlert project={project} />
</ConfirmedIntegrationDataProvider>
```

### 3-2. `InstallResourceTable` — provider label + copyable Resource ID

File: `app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx`

#### 3-2-a. `provider` prop + dynamic header

Extend the props:
```tsx
import type { CloudProvider } from '@/lib/types';

interface InstallResourceTableProps {
  rows: InstallResourceRow[];
  provider: CloudProvider;
}
```

Add a const beside the existing `STATUS_LABEL` / `STATUS_TAG` maps:
```tsx
const RESOURCE_STATUS_COLUMN_LABEL: Record<CloudProvider, string> = {
  AWS: 'Service 상태',
  Azure: 'Private Link 상태',
  GCP: '서비스 리소스 상태',
  IDC: '서비스 리소스 상태',
};
```

Every `CloudProvider` variant from `lib/types.ts` is enumerated; the
exhaustive `Record` avoids the need for an `as` cast or a fallback
branch.

Replace the hardcoded header (line 79) with:
```tsx
<th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>
  {RESOURCE_STATUS_COLUMN_LABEL[provider]}
</th>
```

Update the function signature:
```tsx
export const InstallResourceTable = ({ rows, provider }: InstallResourceTableProps) => {
```

#### 3-2-b. Copyable Resource ID with row-hover reveal

Add the `CopyButton` import:
```tsx
import { CopyButton } from '@/app/components/ui/CopyButton';
```

The row currently reads (line 84-87):
```tsx
<tr key={row.resourceId} className={cn('border-t', borderColors.light)}>
```

Add `group` so children can use `group-hover:*`:
```tsx
<tr key={row.resourceId} className={cn('border-t group', borderColors.light)}>
```

The Resource ID cell currently reads (line 95-97):
```tsx
<td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
  {row.resourceId}
</td>
```

Wrap the value in an `inline-flex` so the button sits beside the text:
```tsx
<td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
  <span className="inline-flex items-center gap-1.5">
    <span>{row.resourceId}</span>
    <CopyButton
      value={row.resourceId}
      label={`${row.resourceId} 복사`}
      className="opacity-0 group-hover:opacity-100"
    />
  </span>
</td>
```

`CopyButton`'s default styling covers size, focus ring, and copied state
(per Wave 9 §3-1). Wave 10 only supplies the reveal class. The explicit
`label` keeps `getByRole('button', { name })` deterministic regardless
of any future Wave 9 default change.

Other cells (DB Type, Region, DB Name, Status) stay untouched — the
prototype only reveals copy buttons next to mono IDs.

### 3-3. Update the one caller — `GcpInstallationInline`

File: `app/components/features/process-status/gcp/GcpInstallationInline.tsx:125`

Current:
```tsx
<InstallResourceTable rows={joinedRows} />
```

After:
```tsx
<InstallResourceTable rows={joinedRows} provider="GCP" />
```

The component is provider-specific (`gcp/...`) so the literal is fine.

Verification before commit:
```bash
git grep -n "<InstallResourceTable" app/
```
Every result must include a `provider=` prop. If a future Azure/AWS
inline appears, each must pass its matching literal.

### 3-4. Tests

#### 3-4-a. `CloudInstallingStep.test.tsx`

File: `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.test.tsx`

Update the existing `GuideCardContainer` and `resolveStepSlot` mocks so
they emit a verifiable sentinel; update the `ProjectPageMeta` mock so it
renders the `action` slot.

```tsx
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string | null }) => (
    <div data-testid="guide-card" data-slot={slotKey ?? ''} />
  ),
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: () => 'process.azure.4',
}));

// ...inside the ProjectPageMeta override:
ProjectPageMeta: ({ action }: { action?: React.ReactNode }) => (
  <div data-testid="page-meta-action">{action}</div>
),
```

The existing DOM-order test stays. Add three new tests:

```tsx
it('mounts GuideCardContainer with the resolved slot key', () => {
  render(<CloudInstallingStep {...azureFixtureProps} />);
  const guide = screen.getByTestId('guide-card');
  expect(guide).toBeInTheDocument();
  expect(guide.getAttribute('data-slot')).toBe('process.azure.4');
});

it('renders the Provider tag in the meta action slot', () => {
  render(<CloudInstallingStep {...azureFixtureProps} providerLabel="Azure Infrastructure" />);
  const action = screen.getByTestId('page-meta-action');
  expect(action).toHaveTextContent('Provider:');
  expect(action).toHaveTextContent('Azure Infrastructure');
});

// One of the two — match the GCP fork decision.
it('renders confirmed-resources for GCP (gate removed)', () => {
  const gcpFixture = { ...azureInstallingFixture, cloudProvider: 'GCP' as const };
  render(<CloudInstallingStep {...gcpFixtureProps} project={gcpFixture} />);
  expect(screen.getByTestId('confirmed-resources')).toBeInTheDocument();
});
// or
it('omits confirmed-resources for GCP (gate kept)', () => {
  const gcpFixture = { ...azureInstallingFixture, cloudProvider: 'GCP' as const };
  render(<CloudInstallingStep {...gcpFixtureProps} project={gcpFixture} />);
  expect(screen.queryByTestId('confirmed-resources')).toBeNull();
});
```

#### 3-4-b. `InstallResourceTable.test.tsx`

File: `app/components/features/process-status/install-task-pipeline/__tests__/InstallResourceTable.test.tsx`

Update every existing `renderToStaticMarkup(<InstallResourceTable ...`
call site to include `provider="GCP"` (preserves prior behavior; the
GCP label matches the existing `서비스 리소스 상태` assertion).

Add two new describe blocks:

```tsx
describe('InstallResourceTable — provider-aware status column label', () => {
  it('AWS provider shows "Service 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="AWS" />,
    );
    expect(html).toContain('Service 상태');
    expect(html).not.toContain('Private Link 상태');
    expect(html).not.toContain('서비스 리소스 상태');
  });

  it('Azure provider shows "Private Link 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="Azure" />,
    );
    expect(html).toContain('Private Link 상태');
    expect(html).not.toContain('Service 상태');
  });

  it('GCP provider shows "서비스 리소스 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="GCP" />,
    );
    expect(html).toContain('서비스 리소스 상태');
  });
});

describe('InstallResourceTable — CopyButton on Resource ID', () => {
  it('mounts a copy button next to every resourceId cell', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable
        rows={[row({ resourceId: 'gcp-r1' }), row({ resourceId: 'gcp-r2' })]}
        provider="GCP"
      />,
    );
    expect(html).toContain('aria-label="gcp-r1 복사"');
    expect(html).toContain('aria-label="gcp-r2 복사"');
  });

  it('hides the copy button by default (row-hover reveal)', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="GCP" />,
    );
    expect(html).toContain('opacity-0');
    expect(html).toContain('group-hover:opacity-100');
  });
});
```

The existing `<tr` count test still passes — the copy button does not
add new `<tr>` elements.

## Step 4: Do NOT touch

- **ADR-014 R3 stepper four files** (`ProcessProgressBar.tsx`,
  `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`,
  `motion/`).
- **Other step components** (`WaitingTargetConfirmationStep`,
  `WaitingApprovalStep`, `ApplyingApprovedStep`, `WaitingConnectionTestStep`,
  `ConnectionVerifiedStep`, `InstallationCompleteStep`). Waves 11/12 own
  these.
- **Other tables** (`WaitingApprovalTable`, `ApprovedIntegrationTable`,
  `ConfirmedIntegrationTable`). Wave 13 owns table-wide CopyButton
  adoption.
- **Provider-specific install inlines other than GCP**. Wave 10 only
  updates `GcpInstallationInline` because it is the sole
  `InstallResourceTable` consumer today.
- **BFF / swagger / route handlers** — no schema change.
- **`lib/theme.ts`** — Wave 9 already ships `cardStyles.cardTitle`. Wave
  10 only consumes existing tokens (`providerColors`, `textColors`).
- **`app/components/ui/CopyButton.tsx`** — Wave 9 ships it; Wave 10
  consumes.
- **`app/components/ui/PageMeta.tsx`** — reference call site only; do
  not refactor.
- **`ScanPill` new / changed states** — Wave 9 ships them but Wave 10
  does not wire any consumer.

## Step 5: Verify

```bash
npx tsc --noEmit

npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudInstallingStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudInstallingStep.test.tsx \
  app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx \
  app/components/features/process-status/install-task-pipeline/__tests__/InstallResourceTable.test.tsx \
  app/components/features/process-status/gcp/GcpInstallationInline.tsx

npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudInstallingStep.test.tsx \
  app/components/features/process-status/install-task-pipeline/__tests__/InstallResourceTable.test.tsx
```

Browser smoke:

1. INSTALLING + Azure: meta strip shows `Provider: Azure Infrastructure`
   with a blue `#0078D4` dot. GuideCard renders below `ProcessStatusCard`.
   Resource table column reads `Private Link 상태`. Row hover reveals
   the copy button; click copies + 1.5s checkmark.
2. INSTALLING + AWS: tag shows orange `#FF9900` dot. Column reads
   `Service 상태`.
3. INSTALLING + GCP: tag shows `#4285F4` dot. Column reads
   `서비스 리소스 상태`. If gate removed: `ConfirmedResourcesSlot`
   ("연동 대상 정보") is visible. If gate kept: hidden (same as today).

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

Wave-9 boundary guard:
```bash
git diff --name-only origin/main -- \
  lib/theme.ts \
  app/components/ui/CopyButton.tsx \
  app/components/ui/PageMeta.tsx \
  | (read -r line && echo "✗ wave 9 boundary crossed: $line" || echo "✓ wave 9 files untouched")
```

## Step 6: Commit + push + PR

```bash
git add \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudInstallingStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudInstallingStep.test.tsx \
  app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx \
  app/components/features/process-status/install-task-pipeline/__tests__/InstallResourceTable.test.tsx \
  app/components/features/process-status/gcp/GcpInstallationInline.tsx

git commit -m "$(cat <<'EOF'
feat(step-polish): Step 4 installing — provider tag, GCP fork decision, GuideCard mount, CopyButton on resource id (wave10)

Closes audit gaps G1 (GuideCard on INSTALLING), G2 (resource-id
copy-on-hover for InstallResourceTable), G5 (GCP fork in
CloudInstallingStep:49). Also closes Wave 7 (PR #472) deferrals:
Provider tag in card header, per-provider status column label.

- CloudInstallingStep: mounts GuideCardContainer with the existing
  resolveStepSlot key. Provider tag (16/700/-0.02em with provider-color
  dot) renders in the ProjectPageMeta action slot. GCP fork decision
  documented in PR body.
- InstallResourceTable: adds provider: CloudProvider prop; column label
  switches per provider (Azure → "Private Link 상태", AWS → "Service 상태",
  GCP → "서비스 리소스 상태"). Resource ID cell wraps the value with the
  Wave 9 CopyButton primitive using group / group-hover:opacity-100.
- GcpInstallationInline: passes provider="GCP" to the table.

No theme edits. No stepper changes. Wave 9 primitives consumed as-is.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push -u origin feat/sit-step-polish-wave10-step4-installing
```

PR body:

```
## Summary

Wave 10 of the step-polish set. Polishes the INSTALLING step
(`ProcessStatus.INSTALLING`) to match `design/SIT Prototype v7 -
standalone.html`. Depends on Wave 9 (foundation primitives).

Closes audit punch list items:
- G1 — GuideCardContainer mounted on INSTALLING.
- G2 — Resource ID copy-on-hover (InstallResourceTable).
- G5 — GCP fork decision in CloudInstallingStep:49.

Also closes Wave 7 (PR #472) deferred items:
- Provider tag in the install card header.
- Per-provider status column label on InstallResourceTable.

## Changes

- `CloudInstallingStep.tsx` — mounts `<GuideCardContainer slotKey>` after
  `<ProcessStatusCard>`; renders a `Provider:` badge inside the
  `ProjectPageMeta.action` slot (16 / 700 / -0.02em, 8px coloured dot
  from `providerColors`).
- `InstallResourceTable.tsx` — adds `provider: CloudProvider` prop;
  switches the resource-status column label per provider; wraps Resource
  ID with the Wave 9 `CopyButton` on a `group / group-hover:opacity-100`
  row.
- `GcpInstallationInline.tsx:125` — passes `provider="GCP"` to the table
  (only call site).
- Tests extended for both component files.

## GCP fork decision

> Implementer fills in after reading `ConfirmedResourcesSlot.tsx`.

Either:
- "Gate removed. `ConfirmedResourcesSlot` consumes `useConfirmedIntegration()`,
  which is provider-agnostic; no GCP-specific field is read." — line 49
  becomes the unconditional `<ConfirmedResourcesSlot />`.

Or:
- "Gate kept. `ConfirmedResourcesSlot` reads `<field>` which is only
  populated for Azure/AWS." — line 49 stays gated with a one-line code
  comment naming the dependency.

## Deferred

- ScanPill `new` / `changed` consumer wiring (`deriveScanPill` stays at
  `'pending'`). Waiting for a real per-resource signal.
- Tooltip on the install task labels (audit G6) — content-driven.
- Hover lift on install-task tiles (audit G9) — purely decorative.

## Out of scope

- Other step components (Waves 11/12).
- Other tables (Wave 13).
- ScanPill consumer wiring.
- BFF / swagger.
- `lib/theme.ts`, `CopyButton.tsx`, `PageMeta.tsx` — Wave 9 ships those;
  Wave 10 only consumes.
- ADR-014 R3 stepper four files (frozen).

## Test plan

- [x] `CloudInstallingStep.test.tsx`: DOM order; GuideCardContainer
  mount with slot key; Provider tag in action slot; GCP fork outcome.
- [x] `InstallResourceTable.test.tsx`: per-provider label (AWS / Azure /
  GCP); CopyButton aria-label on every row; default classes include
  `opacity-0 group-hover:opacity-100`.
- [x] Stepper four-file guard.
- [x] Wave 9 boundary guard.
- [ ] Manual: Step 4 across Azure / AWS / GCP (header tag, GuideCard,
  column label, hover copy button).
```

## Step 7: Self-review checklist

- [ ] `CloudInstallingStep` imports: `GuideCardContainer`, `cn`,
      `providerColors`, `textColors`, `CloudProvider` (type-only).
- [ ] `ProviderBadge` defined inline (single use). No new file under
      `_components/common/`.
- [ ] `slotKey` is passed directly to `<GuideCardContainer />`; no
      duplicate `resolveStepSlot` call.
- [ ] GCP fork decision documented in PR body with one sentence of
      evidence.
- [ ] `InstallResourceTable` `provider` prop is required, not optional.
- [ ] `RESOURCE_STATUS_COLUMN_LABEL` has all five `CloudProvider` keys.
- [ ] `<tr>` has `group`; `CopyButton` className has
      `opacity-0 group-hover:opacity-100`.
- [ ] No `as any`, no relative imports (`@/` only), no raw hex (provider
      dot uses `providerColors[provider].bar`).
- [ ] `GcpInstallationInline` is the only updated caller. No other
      `<InstallResourceTable` reference exists.
- [ ] Stepper four-file guard passes; Wave 9 boundary guard passes.
- [ ] PR body filled in with the GCP fork decision before requesting review.

## Acceptance for this wave

Wave 10 is correct when:

- Step 4 (`ProcessStatus.INSTALLING`) shows a GuideCard below the
  ProcessStatusCard for every provider.
- Page meta strip shows a `Provider: <label>` tag with a provider-
  coloured dot.
- `InstallResourceTable`'s status column label is provider-aware
  (Azure → `Private Link 상태`, AWS → `Service 상태`, GCP →
  `서비스 리소스 상태`).
- Hovering a row reveals a copy button next to the resource ID; clicking
  it copies the value and flips to the checkmark for 1.5s.
- The GCP fork at `CloudInstallingStep.tsx:49` is either removed (the
  audit's recommended outcome) or kept with a one-line code comment.
  Either way, the decision is documented in the PR body.
- Stepper four-file guard passes; Wave 9 boundary guard passes.
- All updated and new tests pass.
