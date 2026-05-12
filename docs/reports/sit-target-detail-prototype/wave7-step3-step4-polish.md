# Wave 7 — Step 3 scan-pill + Step 4 install pipeline polish

## Context

Two visual gaps remain after Waves 1-6:

### Step 3 — 연동 대상 반영중

`ApplyingApprovedStep` shows resources but does not surface per-row integration progress. The prototype's `screen-4` Step 3 table has a "연동 이력" column rendered as `class="scan-pill integrated"` / `class="scan-pill pending"`. Semantics for the shared `ScanPill` primitive (since Wave 4/Step 4 also reuses it):

| Pill | Condition |
|---|---|
| Integrated (green) | resource has been provisioned for monitoring |
| Pending (orange) | resource is mid-flight |
| — (dash) | row that is not an integration target (see "Reality at Step 3" below) |

**Reality at Step 3.** The current Step 3 table is fed by `ApprovedIntegrationSection` → `ApprovedIntegrationTable`, which only contains approved resources. `ApprovedResource` (`lib/types/resources/approved.ts:3-9`) has no `selected` field — excluded resources are surfaced elsewhere (Wave 3 reason chip on the WAITING_APPROVAL surface), not on this table. Therefore every Step 3 row corresponds to an approved-and-integration-targeted resource; the column shows either Integrated (when a signal is available) or Pending.

No new BFF field exists for "Integrated/Pending" — the only adjacent signal would be a terraform-status side fetch. Decision: this wave **does not invent a new state field and does not add a side fetch**. Instead, the column ships with a derive helper that defaults to `'pending'` for every row, and the helper is the hook point a future wave plugs the signal into. The `'none'` state stays in the `ScanPill` primitive because Step 4 may need it; Step 3 never emits it.

### Step 4 — Agent 설치

`InstallTaskPipeline` (`app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx`) renders per-provider install tasks. The prototype's Step 4 has:

- Provider tag in the card header right ("Provider: Azure")
- Below the task pipeline, a "공용 DB List" table with a "Private Link 상태" / "서비스 리소스 상태" column (per provider).
- Pagination (matches Wave 2's `Pagination` primitive — reuse).
- Visual polish on the install task cards: dot color matches `statusColors`, num bubble has the right radius.

The "Private Link 상태" column data: this is the same `terraform-status` per-resource. Today the install task pipeline shows the aggregate status, not per-resource. Adding the per-resource column either requires reading the BFF response shape and confirming a `resources[]` array exists with per-resource state, or accepting a visual-only column with `—` placeholders.

This wave keeps it simple: surface the existing per-resource status if `InstallTaskPipeline` already provides it; otherwise add the column as `—` and note the gap in PR body.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
# All earlier waves merged
git grep -l "WaitingApprovalStats" app/integration/target-sources && echo "✓ Wave 2 merged"
git grep -l "ReasonChipInline" app/components/ui && echo "✓ Wave 3 merged"
git grep -l "deriveHealth" app/integration/target-sources && echo "✓ Wave 5 merged"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave7-step3-step4-polish --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave7-step3-step4-polish
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` `screen-4` Step 3 and Step 4 blocks.
2. `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` — Step 3 card.
3. `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx` — current row shape.
4. `app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx` and `InstallResourceTable.tsx` — Step 4 visuals.
5. `app/components/features/process-status/install-task-pipeline/join-installation-resources.ts` — how installation resources merge into rows. Tells us whether per-resource status is available without a new fetch.
6. `app/lib/api/index.ts` — `terraform-status` and any installation-state endpoint.
7. `app/components/ui/Pagination.tsx` (Wave 2 artifact) for reuse.

## Step 3: Implementation

### 3-1. `scan-pill` UI primitive

Create `app/components/ui/ScanPill.tsx`:

```typescript
import { cn, statusColors } from '@/lib/theme';

export type ScanPillState = 'integrated' | 'pending' | 'none';

interface ScanPillProps {
  state: ScanPillState;
}

const PALETTE: Record<ScanPillState, { bg: string; text: string; dot?: string; label: string }> = {
  integrated: {
    bg: statusColors.success.bg,
    text: statusColors.success.textDark,
    dot: statusColors.success.dot,
    label: 'Integrated',
  },
  pending: {
    bg: statusColors.warning.bg,
    text: statusColors.warning.textDark,
    dot: statusColors.warning.dot,
    label: 'Pending',
  },
  none: {
    bg: 'bg-transparent',
    text: 'text-gray-400',
    label: '—',
  },
};

export const ScanPill = ({ state }: ScanPillProps) => {
  const p = PALETTE[state];
  if (state === 'none') return <span className={cn('text-[12px]', p.text)}>{p.label}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', p.bg, p.text)}>
      {p.dot && <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />}
      {p.label}
    </span>
  );
};
```

Tests:
- Three states render distinct DOM.
- `state="none"` renders just the dash, no chip frame.

### 3-2. Step 3 — derive helper

Create `app/integration/target-sources/[targetSourceId]/_components/approved/scan-pill-derive.ts`:

```typescript
import type { ApprovedResource } from '@/lib/types/resources';
import type { ScanPillState } from '@/app/components/ui/ScanPill';

/**
 * Decide which scan-pill to show for a row at Step 3.
 *
 * `ApprovedIntegrationTable` only receives approved (= selected) resources —
 * `ApprovedResource` carries no `selected` field, and excluded resources are
 * not included in this table. The "none / dash" state is therefore unused at
 * Step 3 and only exists for the shared ScanPill primitive (the future Step 4
 * status column may need it).
 *
 * Default is 'pending'. The hook point for 'integrated' is a future signal
 * source (terraform-status per resource, or a new `integrated_at` field on
 * the response). This wave does NOT add that field; it adds the derive seam.
 */
export const deriveScanPill = (resource: ApprovedResource): ScanPillState => {
  // Hook for future enrichment.
  return 'pending';
};
```

### 3-3. Step 3 — table column

In `ApprovedIntegrationTable.tsx`:

- Append the "연동 이력" column header.
- For every row (every entry in this table is an approved resource), render `<ScanPill state={deriveScanPill(resource)} />`.

Excluded rows are **not** present in this table (`ApprovedIntegrationSection` already filters them out — verify `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` before committing).

Keep the column at the right end of the table.

### 3-4. Step 3 — header subtitle progress count

Update `ApplyingApprovedStep` (or wherever the Step 3 card header subtitle is composed) to include "전체 N건 중 M건 완료" when the count is derivable. Today the count is `selected.length` (all selected resources). Without an "integrated" signal source, M is unknown; use the Wave 3 banner format and add the count only if a clear data source is available:

```jsx
<StepBanner variant="success" icon={...}>
  <strong>승인이 완료되어 시스템에 반영 중입니다.</strong>
  {totalCount > 0 && (
    <>
      {' '}전체 {totalCount}건 · 평균 5분 내외 소요
    </>
  )}
</StepBanner>
```

Drop the "M건 완료" until a follow-up wave provides the data signal. This is honest about the state; do not fabricate a count.

### 3-5. Step 4 — header right provider tag

In `InstallingStep.tsx` (or `CloudInstallingStep`), inject into the card header right:

```jsx
<span className="text-[11.5px] text-gray-500">
  Provider: <strong className="text-gray-900">{providerLabel}</strong>
</span>
```

`providerLabel` is already a prop on `CloudInstallingStep`. Use it.

### 3-6. Step 4 — per-resource status column

Inspect `app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx`. If the table already has a per-row status column whose label reads "Private Link 상태" / "서비스 리소스 상태", no change needed — assert that.

If not:

- Read `join-installation-resources.ts` to see what per-resource state the join produces.
- If per-resource status is available, add a column "Private Link 상태" (Azure) / "서비스 리소스 상태" (GCP) / "Service 상태" (AWS) and render as a Tag (existing `Badge`/`Tag` component).
- If not available, add the column header with `—` cells and call it out in the PR body's "Deferred" section.

### 3-7. Step 4 — pagination on the DB list

Reuse `app/components/ui/Pagination.tsx` from Wave 2. Plug it below the install-resource table:

```jsx
<Pagination
  page={page}
  pageSize={pageSize}
  totalCount={resources.length}
  onPageChange={setPage}
  onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
/>
```

State holders in `InstallResourceTable` (`useState` for `page` and `pageSize` with defaults 0 and 10). Apply the slice in `useMemo` so the row mapping does not re-iterate the whole list per render.

### 3-8. Tests

`ScanPill.test.tsx`:
- Three states render distinct content.

`scan-pill-derive.test.ts`:
- Default `'pending'` for any selected resource.

`ApprovedIntegrationTable.test.tsx`:
- "연동 이력" column renders for each row.
- Every approved row shows `ScanPill state="pending"`.
- (No excluded-row case — `ApprovedResource[]` carries only approved resources.)

`InstallResourceTable.test.tsx`:
- Pagination component mounts.
- Changing page size resets `page` to 0.
- Sliced rows visible.
- Per-resource status column renders the expected label per provider (Azure/GCP/AWS).

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- BFF — no new field, no new endpoint.
- `lib/approval-bff.ts`, `lib/types.ts` — no schema change.
- `WaitingApprovalCard` and the Wave 2 trio — Step 3 is a separate surface.
- Wave 5/6 surfaces — Step 3/4 polish is independent.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/components/ui/ScanPill.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/approved/ \
  app/components/features/process-status/install-task-pipeline/
npm test --run \
  app/components/ui/ScanPill.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/approved/ \
  app/components/features/process-status/install-task-pipeline/
```

Browser:
- Mock target source at `APPLYING_APPROVED`:
  - Selected rows show a `Pending` pill (orange).
  - Excluded rows show `—`.
- Mock target source at `INSTALLING`:
  - Card header shows "Provider: Azure" (or GCP / AWS).
  - DB list under the install task pipeline shows the per-resource status column.
  - Pagination buttons respond.

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

## Step 6: Commit + push + PR

```bash
git add \
  app/components/ui/ScanPill.tsx \
  app/components/ui/ScanPill.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/approved/ \
  app/components/features/process-status/install-task-pipeline/

git commit -m "feat(detail): Step 3 scan-pill + Step 4 polish (wave7)

Step 3 (APPLYING_APPROVED):
- New ScanPill primitive (Integrated / Pending / none).
- ApprovedIntegrationTable adds '연동 이력' column. Selected rows
  default to Pending; excluded rows show dash. deriveScanPill is the
  hook point for a future 'integrated_at' signal.
- Banner shows totalCount when present (no fabricated M-of-N completion).

Step 4 (INSTALLING):
- Card header right shows Provider tag.
- InstallResourceTable gains per-resource status column (label per
  provider). If the join does not produce per-resource state, the
  column renders '—' and the gap is recorded in PR body.
- Pagination reused from Wave 2 Pagination primitive.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/sit-detail-wave7-step3-step4-polish
```

PR body:
```
## Summary

Wave 7 of the target-source detail prototype migration. Visual polish
on Step 3 (APPLYING_APPROVED) and Step 4 (INSTALLING).

## Step 3

- `ScanPill` primitive: Integrated / Pending / none.
- Approved-integration table adds 연동 이력 column.
- Selected rows default to Pending; excluded show dash.
- `deriveScanPill` is the hook point for a future Integrated state
  source (e.g. terraform-status per resource). It does **not** ship
  Integrated in this PR — that requires a data signal.

## Step 4

- Card header shows Provider label.
- Install-resource table gains a per-resource status column with the
  prototype's label per provider.
- Pagination reuses the Wave 2 `Pagination` primitive.

## Deliberately excluded

- Inventing a per-resource Integrated state without a data source.
- Fabricating an M-of-N progress count in the Step 3 banner.
- ProcessStatus stepper changes (ADR-014 R3 freeze).

## Test plan
- [x] ScanPill 3-state rendering
- [x] Approved table column appears
- [x] Excluded rows show dash, selected show Pending
- [x] Step 4 header right shows Provider tag
- [x] Step 4 pagination responds
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] `ScanPill state="none"` does not render a chip frame (just dash text)
- [ ] `deriveScanPill` returns `'pending'` by default; comment explains the hook point
- [ ] No new BFF field invented
- [ ] No fabricated "completed count" in Step 3 banner
- [ ] Pagination state lives in `InstallResourceTable`, not lifted higher
- [ ] Page size change resets `page` to 0
- [ ] Stepper four-file guard passes

## Acceptance for this wave

Wave 7 is correct when:
- Step 3 table shows the 연동 이력 column with Pending/dash semantics.
- Step 4 card header shows the Provider label.
- Step 4 install-resource table renders the per-provider status column header (with real data when available, `—` otherwise) and a working pagination row.
- Stepper four-file guard passes.
