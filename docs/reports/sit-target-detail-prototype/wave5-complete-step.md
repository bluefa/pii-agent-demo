# Wave 5 — Step 7 visual fill (Healthy badge, action row, logical DB columns)

## Context

Wave 4 shipped `InstallationCompleteStep` as a shell. This wave fills it with the prototype's `screen-4` Step 7 visual:

- Status badge in the card header: "Healthy" / "Unhealthy" pill driven by per-DB connection status.
- Status column in the confirmed-integration table: per-row Healthy/Unhealthy badge with a Tooltip explaining the rule.
- Two new columns: **연동 대상 논리 DB** count, **연동 제외 논리 DB** count. Both render `—` placeholders pending the logical-DB BFF (Wave 6 adds the modal UI shell but does not persist; the data is not yet available).
- Action row inside the card body: **"인프라 변경"** + **"연결 테스트 재실행"** buttons. Click handlers are `toast.info("기능 준비중입니다.")` for now.

The Healthy/Unhealthy derive rule: `connectionStatus === 'CONNECTED' → Healthy`, `connectionStatus === 'DISCONNECTED' → Unhealthy`. When a future BFF schema adds a dedicated `healthStatus`, swap the derive helper.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "InstallationCompleteStep" app/integration/target-sources && echo "✓ Wave 4 merged"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave5-complete-step --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave5-complete-step
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` `screen-4` Step 7 block. Note the Status column header includes a tooltip-trigger `<svg>` and the Status pill uses `class="status healthy"` / `class="status"` with explicit color overrides for Unhealthy.
2. `app/integration/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep.tsx` — Wave 4 shell.
3. `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable.tsx` — current columns.
4. `lib/types/resources/confirmed.ts` — `ConfirmedResource` shape.
5. `app/components/ui/Tooltip.tsx` + `app/components/ui/Badge.tsx` — UI primitives to reuse.
6. `app/components/ui/toast` and `useToast` hook — for `toast.info` action stubs.

## Step 3: Implementation

### 3-1. Health derive helper

Create `app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status.ts`:

```typescript
import type { ConfirmedResource } from '@/lib/types/resources';

/**
 * Per-DB health status — derived from connectionStatus.
 *
 * The BFF does not yet expose a dedicated healthStatus field. This helper
 * is the single derive point. When the BFF schema gains a healthStatus,
 * replace the body of this function and the column shape stays.
 */
export type HealthStatus = 'healthy' | 'unhealthy';

export const deriveHealth = (resource: ConfirmedResource): HealthStatus =>
  resource.connectionStatus === 'CONNECTED' ? 'healthy' : 'unhealthy';

export const aggregateHealth = (resources: readonly ConfirmedResource[]): HealthStatus => {
  if (resources.length === 0) return 'healthy';   // empty list → no failure → Healthy
  return resources.every((r) => deriveHealth(r) === 'healthy') ? 'healthy' : 'unhealthy';
};
```

Add `health-status.test.ts`:
- Single CONNECTED → healthy
- Single DISCONNECTED → unhealthy
- Mix → aggregate is unhealthy
- All CONNECTED → aggregate healthy
- Empty list → aggregate healthy

### 3-2. Status badge — small inline component

Create `app/integration/target-sources/[targetSourceId]/_components/confirmed/HealthBadge.tsx`:

```typescript
import { cn, statusColors } from '@/lib/theme';
import type { HealthStatus } from './health-status';

interface HealthBadgeProps {
  status: HealthStatus;
}

export const HealthBadge = ({ status }: HealthBadgeProps) => {
  const palette = status === 'healthy' ? statusColors.success : statusColors.error;
  const label = status === 'healthy' ? 'Healthy' : 'Unhealthy';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium',
      palette.bg,
      palette.textDark,
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
      {label}
    </span>
  );
};
```

### 3-3. Status column tooltip

Add a `InfoTooltip` next to the Status column header. The tooltip body documents the derive rule. Single source of truth for the user-facing copy:

```typescript
// inside ConfirmedIntegrationTable
import { Tooltip } from '@/app/components/ui/Tooltip';
import { InfoIcon } from '@/app/components/ui/icons';
import { HealthBadge } from './HealthBadge';

const STATUS_TOOLTIP_CONTENT = (
  <div className="space-y-2 text-[12px] leading-[1.5]">
    <div className="font-semibold">Status 안내</div>
    <div className="flex items-start gap-2">
      <HealthBadge status="healthy" />
      <span>모든 DB가 정상이에요.</span>
    </div>
    <div className="flex items-start gap-2">
      <HealthBadge status="unhealthy" />
      <span>DB가 비정상이에요. Agent 또는 Credential 상태를 확인해주세요.</span>
    </div>
  </div>
);
```

### 3-4. `ConfirmedIntegrationTable` — column expansion

Update `ConfirmedIntegrationTable.tsx`. Current columns: `리소스 ID / 유형 / DB 타입 / Credential`. Final columns for Step 7 view:

| # | Header | Source |
|---|---|---|
| 1 | DB Type | `resource.databaseType` |
| 2 | Resource ID | `resource.resourceId` |
| 3 | Region | (from confirmed shape — verify if present; if not, drop) |
| 4 | Resource Name | (same caveat) |
| 5 | DB Credential | `resource.credentialId` |
| 6 | 연동 대상 논리 DB | placeholder `—` |
| 7 | 연동 제외 논리 DB | placeholder `—` |
| 8 | Status | derived via `deriveHealth(resource)` |

Add the Tooltip to the Status column header. The two logical-DB count columns render `—` from a constant.

Read `lib/types/resources/confirmed.ts` to confirm whether `region` / `resourceName` exist on `ConfirmedResource`. If not, drop those columns instead of inventing fields. The fall-back column set is:

| # | Header |
|---|---|
| 1 | DB Type |
| 2 | Resource ID |
| 3 | DB Credential |
| 4 | 연동 대상 논리 DB |
| 5 | 연동 제외 논리 DB |
| 6 | Status |

### 3-5. Step 6 vs Step 7 — keep the table shape per step

The same `ConfirmedIntegrationTable` is mounted in:
- Step 5 (`WaitingConnectionTestStep`) via `ConfirmedResourcesSlot`
- Step 6 (`ConnectionVerifiedStep`)
- Step 7 (`InstallationCompleteStep`)

The Status column with Healthy/Unhealthy makes sense only at Step 7. Decision:

- Add a `variant` prop to `ConfirmedIntegrationTable`: `'pre-install' | 'complete'`.
- `'pre-install'` (Steps 5/6): existing columns. No Status column. No logical DB columns.
- `'complete'` (Step 7): new column set with Status + logical DB placeholders.

Plumb `variant="complete"` from `InstallationCompleteStep` → `ConfirmedResourcesSlot` → `ConfirmedIntegrationTable`. Default value `'pre-install'` so existing call sites do not break.

### 3-6. `InstallationCompleteStep` — header status badge + action row

Update `InstallationCompleteStep.tsx`:

```typescript
import { useToast } from '@/app/components/ui/toast';
import { Button } from '@/app/components/ui/Button';
import { ReloadIcon, EditIcon } from '@/app/components/ui/icons';
import { HealthBadge } from '@/app/integration/.../confirmed/HealthBadge';
import { aggregateHealth } from '@/app/integration/.../confirmed/health-status';
import { useConfirmedIntegration } from '@/app/integration/.../data/ConfirmedIntegrationDataProvider';
```

In the header, replace the empty placeholder slot with:
```jsx
<InstallationCompleteHeaderRight />
```

Where `InstallationCompleteHeaderRight` is an inline component that reads from the data provider:
```typescript
const InstallationCompleteHeaderRight = () => {
  const { state } = useConfirmedIntegration();
  if (state.status !== 'ready') return null;
  const aggregate = aggregateHealth(state.data);
  return <HealthBadge status={aggregate} />;
};
```

In the card body, before `<ConfirmedResourcesSlot variant="complete" />`, render the action row:
```typescript
const InstallationCompleteActions = () => {
  const toast = useToast();
  const stub = (label: string) => () => toast.info(`${label} 기능 준비중입니다.`);
  return (
    <div className="flex justify-end gap-2 mb-3">
      <Button variant="warning-outline" onClick={stub('인프라 변경')}>
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </Button>
      <Button variant="warning-outline" onClick={stub('연결 테스트 재실행')}>
        <ReloadIcon className="w-3.5 h-3.5" />
        연결 테스트 재실행
      </Button>
    </div>
  );
};
```

Notes:
- If `Button` does not have a `warning-outline` variant, use `variant="secondary"` and override class with `cn(getButtonClass('secondary'), 'border-orange-200 text-orange-800 hover:bg-orange-50')` — but check `buttonStyles.variants` first; the variant may exist.
- `EditIcon` / `ReloadIcon`: confirm presence in `app/components/ui/icons`. Reuse pencil and refresh icons already in use elsewhere (DeleteInfrastructureButton has its own delete icon; the codebase likely already has Pencil/Refresh).

### 3-7. Step 6 — add retest button

The prototype's Step 6 also has a "연결 테스트 재실행" button. Wave 4 deferred this. Add it here so steps 6/7 share the retest action.

In `ConnectionVerifiedStep.tsx`, append below `<ConfirmedResourcesSlot />` (Wave 4 path) the retest button row:

```jsx
<div className="flex justify-end mt-4">
  <Button variant="warning-outline" onClick={() => toast.info('연결 테스트 재실행 기능 준비중입니다.')}>
    <ReloadIcon className="w-3.5 h-3.5" />
    연결 테스트 재실행
  </Button>
</div>
```

### 3-8. Tests — update + add

- `health-status.test.ts` (3-1).
- `ConfirmedIntegrationTable.test.tsx`:
  - `variant="pre-install"` (default) renders the old columns.
  - `variant="complete"` renders Status, 연동 대상 논리 DB, 연동 제외 논리 DB.
  - Healthy badge appears for CONNECTED rows.
  - Unhealthy badge appears for DISCONNECTED rows.
  - Logical DB count cells render `—`.
- `InstallationCompleteStep.test.tsx`:
  - Header right shows Healthy when all confirmed resources are CONNECTED.
  - Header right shows Unhealthy when at least one is DISCONNECTED.
  - Action buttons render and clicking each fires a toast (mock `useToast`).
- `ConnectionVerifiedStep.test.tsx`:
  - Retest button appears at the bottom of the card body.

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- `WaitingConnectionTestStep.tsx` — Step 5 logical DB modal is Wave 6.
- BFF schemas / routes / swagger.
- `lib/types/resources/confirmed.ts` — no new fields. The Status column derives from existing `connectionStatus`.
- `aggregateHealth` empty-list policy: keep "empty → healthy" to match the prototype's "no failure → Healthy" reading. Do not change to `'unknown'` or null.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/confirmed/ \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/
npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/confirmed/ \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/
```

Browser:
- Mock target source at `INSTALLATION_COMPLETE`:
  - Card header shows Healthy/Unhealthy pill based on the mix of `connectionStatus` in the seeded data.
  - Status column appears in the table. Tooltip on the column-header info icon shows the rule.
  - Logical DB count columns show `—`.
  - Action row shows the two buttons; clicking each fires a toast.
- Mock target source at `CONNECTION_VERIFIED`:
  - Retest button visible at the bottom of the card body. Click fires a toast.
- Mock target source at `WAITING_CONNECTION_TEST`:
  - `ConfirmedIntegrationTable` still uses pre-install columns (no Status, no logical DB columns).

Stepper guard:
```bash
git diff --name-only origin/main | grep -E "ProcessProgressBar|StepProgressBar|InstallationProcessProgressBar|stepperMotion" && echo "✗" || echo "✓"
```

## Step 6: Commit + push + PR

```bash
git add app/integration/target-sources/'[targetSourceId]'/_components/confirmed/ app/integration/target-sources/'[targetSourceId]'/_components/layout/

git commit -m "feat(complete-step): Healthy badge + action row + status column (wave5)

Step 7 (INSTALLATION_COMPLETE) visual fill:
- HealthBadge derived from connectionStatus (CONNECTED → Healthy,
  DISCONNECTED → Unhealthy).
- aggregateHealth used in the card header right.
- ConfirmedIntegrationTable gains variant='complete' columns: Status
  with tooltip, 연동 대상/제외 논리 DB count placeholders.
- Action row: '인프라 변경' and '연결 테스트 재실행' — toast stubs.
- ConnectionVerifiedStep adds the retest button per the prototype.

Logical DB count columns render '—' until Wave 6 backs them with data.
When BFF later exposes a healthStatus field, deriveHealth is the swap
point.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/sit-detail-wave5-complete-step
```

PR body:
```
## Summary

Wave 5 of the target-source detail prototype migration. Fills the
Wave 4 shell for Step 7 with the prototype's Healthy/Unhealthy badge,
Status column with tooltip, action row, and logical-DB count columns
(placeholder `—` until BFF backing).

## Changes

- `confirmed/health-status.ts` + tests — derive helper.
- `confirmed/HealthBadge.tsx` — badge component.
- `confirmed/ConfirmedIntegrationTable.tsx` — `variant` prop, new
  column set on `variant='complete'`.
- `layout/InstallationCompleteStep.tsx` — header badge + action row.
- `layout/ConnectionVerifiedStep.tsx` — retest button row.
- New tests across the four files.

## Data flow

- HealthBadge: derived from existing `ConfirmedResource.connectionStatus`.
- Logical DB count columns: `—` placeholder. Wave 6 introduces the
  modal UI; the BFF backing for the counts is out of scope of this
  wave-set.
- Action buttons: `toast.info` stubs. Real navigation is deferred to a
  follow-up spec.

## Deliberately excluded

- Logical DB count data (Wave 6 owns the modal; column data still
  unbacked).
- BFF healthStatus field — derive helper is the swap point when it
  ships.
- Real navigation / mutation behind the action buttons — toast stubs
  signal "in progress" intentionally.
- ProcessStatus stepper changes (ADR-014 R3 freeze).

## Test plan
- [x] healthStatus derive table (CONNECTED/DISCONNECTED/aggregate)
- [x] ConfirmedIntegrationTable variant flip
- [x] Tooltip content for Status column header
- [x] Action buttons fire toasts on click
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] `aggregateHealth([])` returns `'healthy'`
- [ ] No new field invented on `ConfirmedResource`
- [ ] `variant='pre-install'` is the default (existing call sites untouched)
- [ ] Action button stubs use `toast.info`, not `console.log` or `alert`
- [ ] Tooltip header reads "Status 안내" exactly
- [ ] Stepper four-file guard passes
- [ ] No raw hex outside `lib/theme.ts` (`statusColors.success` / `statusColors.error` consumed)

## Acceptance for this wave

Wave 5 is correct when:
- Step 7 card header displays a Healthy/Unhealthy pill matching the data.
- Step 7 table shows the Status column with per-row badges and a hover-info tooltip on the header.
- Step 7 logical DB count columns render `—` cells.
- Step 7 action row renders the two buttons; each click fires a toast.
- Step 6 retest button renders below the read-only table.
- Stepper four-file guard passes.
