# Wave 3 — Reason chip + Banner timestamps/approver

## Context

The prototype's Step 2 / Step 3 tables show, on rows where the resource was excluded, a `reason-chip-inline` chip that on hover displays a tooltip with the full exclusion reason text and meta (`등록자: 조용준 · 2026-05-08`). The Step 2/Step 3 cards also show, in the header subtitle, request/approval timestamps and the approver/requester name.

The data exists in current BFF responses:

- `excluded_resource_infos[].exclusion_reason` (string | undefined) — `lib/approval-bff.ts:25,74`, `app/lib/api/index.ts:266,389-393`.
- `approval-requests/latest.requested_at` (ISO string) and `requested_at`-level `requested_by` (user id string) — `app/lib/api/index.ts:510-528`.
- `approved_integration.approved_at` (ISO string) — `app/lib/api/index.ts:361`.

Wave 2 already added a `WaitingApprovalStats` + `WaitingApprovalToolbar` + `Pagination` set. This wave plugs into that scaffolding to surface the existing reason text and timestamps.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "WaitingApprovalStats" app/integration/target-sources && echo "✓ Wave 2 merged"
git grep -l "exclusion_reason" lib/approval-bff.ts && echo "✓ BFF field present"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave3-reason-chip --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave3-reason-chip
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` `screen-4` Step 2 — find `class="reason-chip-inline"` for the chip shape and `data-reason` / `data-reason-meta` for the tooltip content.
2. `app/components/ui/Tooltip.tsx` — existing tooltip primitive.
3. `lib/approval-bff.ts:25-74` — `ExcludedResourceInfoDto` shape.
4. `app/lib/api/index.ts:357-397` — `ApprovedIntegrationResponse`.
5. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx` — current after Wave 2.
6. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx` — current row shape.
7. `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` — Step 3 (APPLYING_APPROVED) card.

## Step 3: Implementation

### 3-1. `ReasonChipInline` — new shared UI component

Create `app/components/ui/ReasonChipInline.tsx`:

```typescript
import { StatusInfoIcon } from '@/app/components/ui/icons';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { cn, textColors } from '@/lib/theme';

interface ReasonChipInlineProps {
  /** full reason text — shown inside the tooltip popover */
  reason: string;
  /** short summary text inside the chip (≤ 40 chars). If absent, derives from reason. */
  summary?: string;
  /** "등록자: 홍길동 · 2026-05-08" — secondary line inside the tooltip */
  meta?: string;
}

const DEFAULT_SUMMARY_LIMIT = 40;

const deriveSummary = (reason: string): string => {
  if (reason.length <= DEFAULT_SUMMARY_LIMIT) return reason;
  return reason.slice(0, DEFAULT_SUMMARY_LIMIT).trimEnd() + '…';
};

export const ReasonChipInline = ({ reason, summary, meta }: ReasonChipInlineProps) => {
  const displaySummary = summary ?? deriveSummary(reason);
  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="text-[12.5px] leading-[1.5]">{reason}</div>
          {meta && <div className="text-[11px] text-gray-500">{meta}</div>}
        </div>
      }
      size="md"
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full',
          'border border-gray-200 bg-gray-50',
          'px-2 py-0.5 text-[11.5px] font-medium',
          textColors.secondary,
          'cursor-default',
        )}
      >
        <StatusInfoIcon className="h-3 w-3 text-gray-400" />
        <span className="truncate max-w-[200px]">{displaySummary}</span>
      </span>
    </Tooltip>
  );
};
```

Notes:
- `Tooltip` already exists at `app/components/ui/Tooltip.tsx`. Its API exposes `content`, `size`, and accepts children as the trigger element.
- If the existing `Tooltip` does not accept JSX `content`, fall back to a single-string `content` and concatenate `reason` + `meta` with a separator. Read `Tooltip.tsx` before committing to the JSX shape.
- The chip itself does not navigate or open a modal. Hover only.

Add `ReasonChipInline.test.tsx`:
- Renders the summary text.
- Default summary derives the first 40 chars + `…` when reason is long.
- Provided `summary` prop wins over auto-derivation.

### 3-2. `WaitingApprovalTable` — add reason column

Update `WaitingApprovalResource` (in `WaitingApprovalTable.tsx`):
```typescript
export interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;
  region: string;
  resourceName: string;
  selected: boolean;
  scanStatus?: ResourceScanStatus | null;
  exclusionReason?: string;            // NEW
  excludedBy?: string;                  // NEW — registrant user id, optional
  excludedAt?: string;                  // NEW — ISO timestamp, optional
}
```

Append a column to `COLUMNS`:
```typescript
const COLUMNS = [
  { label: '#', widthClass: 'w-9' },
  { label: 'DB Type' },
  { label: 'Resource ID' },
  { label: 'Region' },
  { label: 'Resource Name' },
  { label: '연동 대상 여부' },
  { label: '스캔 이력' },
  { label: '제외 사유' },               // NEW
] as const;
```

Inside the table body row, render the new cell:
```typescript
<td className={cn(tableStyles.cell, 'text-sm')}>
  {resource.selected || !resource.exclusionReason ? (
    <span className={textColors.quaternary}>—</span>
  ) : (
    <ReasonChipInline
      reason={resource.exclusionReason}
      meta={buildReasonMeta(resource.excludedBy, resource.excludedAt)}
    />
  )}
</td>
```

Helper `buildReasonMeta`:
```typescript
const buildReasonMeta = (excludedBy?: string, excludedAt?: string): string | undefined => {
  const bits: string[] = [];
  if (excludedBy) bits.push(`등록자: ${excludedBy}`);
  if (excludedAt) bits.push(formatDate(excludedAt, 'date'));   // '2026-05-08'
  return bits.length === 0 ? undefined : bits.join(' · ');
};
```

`formatDate` is already at `lib/utils/date.ts` (used by Wave 1 area).

### 3-3. `WaitingApprovalCard` — wire reason data into `toExcludedRow`

In `WaitingApprovalCard.tsx`, update the existing `toExcludedRow` mapper to forward the reason:

```typescript
const toExcludedRow = (item: ApprovedIntegrationExcludedResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.database_type ?? '',
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: false,
  scanStatus: item.scan_status ?? null,
  exclusionReason: item.exclusion_reason ?? undefined,
  // excludedBy / excludedAt: only forward if BFF response shape exposes them.
  // If absent on `ApprovedIntegrationExcludedResourceItem`, drop these
  // two assignments and the columns just show the reason text without meta.
});
```

Verify whether `ExcludedResourceInfoDto` (`lib/approval-bff.ts`) currently carries `excluded_by` / `excluded_at`. If absent, leave the fields off the mapped row — the reason chip will still render, just without the meta line.

If the BFF response does not carry registrant/timestamp fields, the wave is still complete — the chip shows reason text only. Do not add new BFF fields in this wave.

### 3-4. Step 2 banner — show requested_at + requested_by

Currently `WaitingApprovalCard.tsx` renders:
```jsx
<p className="mt-1 text-[12px] text-gray-500">
  요청하신 DB 목록을 관리자가 확인하고 있어요.
</p>
```

Extend the subtitle to include request metadata when present:

```typescript
import { getApprovalRequestLatest } from '@/app/lib/api';
import { formatDate } from '@/lib/utils/date';
```

Inside the card, parallel to the existing `getApprovedIntegration` fetch, add a `getApprovalRequestLatest` fetch and stash `requested_at` + `requested_by`. When both are present, render:

```jsx
<p className="mt-1 text-[12px] text-gray-500">
  요청하신 DB 목록을 관리자가 확인하고 있어요.
  {' · '}요청일시 <strong className="text-gray-800">{formatDate(requestedAt, 'datetime')}</strong>
  {' · '}요청자 <strong className="text-gray-800">{requestedBy}</strong>
</p>
```

When either field is missing, fall back to the existing one-sentence subtitle (no trailing `·` chunks).

If a second fetch feels heavy:
- The mock adapter (`lib/bff/mock-adapter.ts`) already wires `getApprovalRequestLatest`. Production code uses `lib/bff/http.ts`.
- Treat fetch failure as "metadata not available" — render the bare subtitle. Do not surface an error UI for the subtitle.

### 3-5. Step 3 banner — show approved_at + approver

`app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` already loads `approved_integration`. The response carries `approved_at` (`app/lib/api/index.ts:361`).

Currently the Step 3 banner reads "관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다." Extend it:

```jsx
<p className="mt-1 text-[12px] text-gray-500">
  관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다.
  {' · '}승인일시 <strong>{formatDate(approvedAt, 'datetime')}</strong>
  {approver && <>{' · '}승인자 <strong>{approver}</strong></>}
</p>
```

If the BFF response shape exposes an approver name field, use it. If not, omit the `승인자` segment. Do not invent a field.

Read the actual fields exposed on `ApprovedIntegrationResponse` before adding the approver tag:

```bash
grep -n "approved_at\|approved_by\|approver" app/lib/api/index.ts lib/approval-bff.ts
```

### 3-6. Tests — add

`ReasonChipInline.test.tsx` — as listed in 3-1.

`WaitingApprovalCard.test.tsx` additions:
- Excluded row with `exclusionReason` renders the chip in the 제외사유 column.
- Selected row in the 제외사유 column shows `—`.
- Subtitle reads "요청일시 …" when `requested_at` + `requested_by` are present.
- Subtitle falls back to the bare sentence when `getApprovalRequestLatest` rejects.

`ApprovedIntegrationSection.test.tsx` additions (if the file exists):
- Subtitle includes "승인일시" when `approved_at` present.

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- `lib/approval-bff.ts` — no schema change. Reading is fine; writing requires a BFF ADR.
- `lib/types.ts` — no enum or type change.
- Wave 0 design tokens / Wave 1 PageMeta / Wave 2 stats/toolbar.
- Other step components (CandidateResourceSection, ConnectionTestStep, etc.).

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/components/ui/ReasonChipInline.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ \
  app/integration/target-sources/'[targetSourceId]'/_components/approved/
npm test --run \
  app/components/ui/ReasonChipInline.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.test.tsx
```

Browser:
- Find a mock target source with `excluded_resource_infos` carrying `exclusion_reason`. Existing fixture: `app/integration/api/v1/__tests__/approved-integration-route.test.ts:55` (`exclusion_reason: 'manual exclude'`).
- Verify chip renders, tooltip on hover shows full reason and meta line.
- Step 2 banner shows request timestamp.
- Step 3 banner shows approval timestamp.

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
  app/components/ui/ReasonChipInline.tsx \
  app/components/ui/ReasonChipInline.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ \
  app/integration/target-sources/'[targetSourceId]'/_components/approved/

git commit -m "feat(waiting-approval): reason chip + banner timestamps (wave3)

Surface existing BFF fields in the UI:
- ReasonChipInline: hover-tooltip chip in 제외사유 column. Backed by
  excluded_resource_infos[].exclusion_reason (already in response).
- Step 2 banner: requested_at + requested_by from
  approval-requests/latest.
- Step 3 banner: approved_at from approved_integration.

No BFF or type changes. When optional fields are absent the UI falls
back to the bare subtitle / dash placeholder.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feat/sit-detail-wave3-reason-chip
```

PR body:
```
## Summary

Wave 3 of the target-source detail prototype migration. Surfaces three
data points that are already in the BFF response but were previously
invisible in the UI:
- per-resource exclusion reason
- approval-request timestamp + requester
- approval timestamp

## Why now

After Wave 2 added the table toolbar and pagination, the table rows
themselves are the next visible gap vs the prototype `screen-4` Step 2.
Reason chip is the highest-information addition.

## Changes

- `app/components/ui/ReasonChipInline.tsx` — new chip with hover
  tooltip.
- `WaitingApprovalTable` — adds 제외사유 column, only renders chip on
  excluded rows.
- `WaitingApprovalCard` — fires a parallel `getApprovalRequestLatest`
  and renders the timestamp/requester in the subtitle when present.
- `ApprovedIntegrationSection` — extends subtitle with approval
  timestamp.

## Data flow

All values come from existing fields on existing endpoints
(`/approved-integration`, `/approval-requests/latest`). No swagger
changes, no schema migration.

## Deliberately excluded

- `excluded_by` / `excluded_at` metadata: forwarded only if the BFF
  response carries them today. If the current schema is silent on
  those, the chip renders without the meta line; expanding the BFF
  is a separate spec.
- ProcessStatus stepper changes — frozen by ADR-014 R3.

## Test plan
- [x] Excluded row renders chip in 제외사유 column
- [x] Selected row shows `—`
- [x] Tooltip shows full reason text
- [x] Subtitle shows 요청일시 when metadata present
- [x] Subtitle falls back when metadata absent
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] `ReasonChipInline` truncates long summaries (`…` ellipsis)
- [ ] Selected rows show `—` in 제외사유 column
- [ ] No new BFF fields invented
- [ ] Subtitle gracefully degrades when metadata fetch fails
- [ ] Stepper four-file guard passes
- [ ] No raw hex outside `lib/theme.ts`

## Acceptance for this wave

Wave 3 is correct when:
- A `WAITING_APPROVAL` row whose `exclusion_reason` is set renders the chip with a hover tooltip on the page.
- A `WAITING_APPROVAL` page subtitle shows the request timestamp + requester (if `getApprovalRequestLatest` returns them).
- An `APPLYING_APPROVED` page subtitle shows the approval timestamp.
- Stepper four-file guard passes.
