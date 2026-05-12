# Wave 7 — Step 3 scan-pill + Step 4 install pipeline polish

## Context

Two visual gaps remain after Waves 1-6:

### Step 3 — 연동 대상 반영중

`ApplyingApprovedStep` shows resources but does not surface per-row integration progress. The prototype's `screen-4` Step 3 table has a "연동 이력" column rendered as `class="scan-pill integrated"` / `class="scan-pill none"`. Semantics:

| Pill | Condition |
|---|---|
| Integrated (green) | resource has been provisioned for monitoring |
| Pending (orange) | resource is mid-flight |
| — (dash) | excluded resource (`selected === false`) — no integration occurs |

No new BFF field exists for "Integrated/Pending" — the only adjacent signal is the same response's `resource_infos` array having or not having terraform/installation results. Decision: this wave **does not invent a new state field**. Instead, the column is added with a derive helper that returns `'integrated' | 'pending' | 'none'` from existing data. The mapping is:

- excluded row (`selected === false`) → `'none'`
- selected row with a terraform-status side fetch indicating completion → `'integrated'`
- selected row otherwise → `'pending'`

If `terraform-status` is not callable in the current Step 3 step (it might not be), the fall-back rule is `selected → 'pending'` and `excluded → 'none'`. The `'integrated'` state ships as a visual but only fires once we have a signal source.

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
import { cn, statusColors, textColors } from '@/lib/theme';

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
import type { ApprovedIntegrationResourceItem } from '@/app/lib/api';
import type { ScanPillState } from '@/app/components/ui/ScanPill';

/**
 * Decide which scan-pill to show for a selected resource at Step 3.
 *
 * Excluded rows never show a pill (caller passes the row through this
 * helper only when `selected === true`). For selected rows, the BFF
 * response does not yet carry a per-resource 'integrated' bit, so we
 * default to 'pending' and let a follow-up wave plug terraform-status
 * data in.
 */
export const deriveScanPill = (resource: ApprovedIntegrationResourceItem): ScanPillState => {
  // Hook for future enrichment: if the response gains an `integrated_at`
  // or terraform-status reference, branch here.
  return 'pending';
};
```

### 3-3. Step 3 — table column

In `ApprovedIntegrationTable.tsx`:

- Append the "연동 이력" column header.
- Per row:
  - If `selected === false`: render `<ScanPill state="none" />` (or `—` directly).
  - If `selected === true`: render `<ScanPill state={deriveScanPill(resource)} />`.

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
- Selected rows show `ScanPill state="pending"`.
- Excluded rows show `state="none"` (the dash).

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
git diff --name-only origin/main | grep -E "ProcessProgressBar|StepProgressBar|InstallationProcessProgressBar|stepperMotion" && echo "✗" || echo "✓"
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
