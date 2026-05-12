# Wave 4 — Step 5/6/7 layout split

## Context

`CloudTargetSourceLayout` (`app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx`) currently funnels steps 5/6/7 into a single `ConnectionTestStep`:

```typescript
case ProcessStatus.WAITING_CONNECTION_TEST:
case ProcessStatus.CONNECTION_VERIFIED:
case ProcessStatus.INSTALLATION_COMPLETE:
  return <ConnectionTestStep {...props} />;
```

The prototype's `screen-4` renders three visually distinct cards for these three states:

- Step 5 (WAITING_CONNECTION_TEST): "연결 테스트" card with `Run Test` button, Connection Status column, "논리 DB 확인" button per row, "완료 승인 요청" CTA.
- Step 6 (CONNECTION_VERIFIED): "완료 여부 관리자 승인 대기" card with banner "최종 관리자 승인을 기다리고 있어요", read-only table, "연결 테스트 재실행" button.
- Step 7 (INSTALLATION_COMPLETE): "PII 모니터링 모듈 연동 완료" card with "Healthy" status badge, columns for 논리 DB counts, "인프라 변경" / "연결 테스트 재실행" buttons.

This wave splits the switch into three components so each step owns its layout. **Visual fill for Steps 5/6/7 is intentionally minimal in this wave** — Step 6 banner and read-only table land here; Step 5 logical-DB button and Step 7 health/logical-DB columns are Waves 6 and 5 respectively.

This is a structural refactor with one visual addition (Step 6 banner).

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "ReasonChipInline" app/components/ui && echo "✓ Wave 3 merged"
test -f app/integration/target-sources/'[targetSourceId]'/_components/layout/ConnectionTestStep.tsx && echo "✓ baseline file present"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave4-step-split --prefix refactor
cd /Users/study/pii-agent-demo-sit-detail-wave4-step-split
```

## Step 2: Required reading

1. `docs/adr/012-target-source-page-layout.md` — section R1–R5 (Step Components with Slots pattern).
2. `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx` — current switch.
3. `app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestStep.tsx` — current single-step component for 5/6/7.
4. `app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestSlot.tsx`, `ConfirmedResourcesSlot.tsx` — the two slot children.
5. `design/SIT Prototype v7 - standalone.html` `screen-4` Step 5, Step 6, Step 7 blocks.
6. `lib/types.ts` `ProcessStatus` enum.

## Step 3: Implementation

### 3-1. Rename `ConnectionTestStep` → `WaitingConnectionTestStep`

The existing file becomes the Step 5 component. Move via `git mv`:

```bash
git mv \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ConnectionTestStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.tsx

git mv \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ConnectionTestStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.test.tsx
```

Inside the renamed file:
- Rename the exported component `ConnectionTestStep` → `WaitingConnectionTestStep`.
- Keep the same prop interface (`project`, `identity`, `providerLabel`, `action`, `onProjectUpdate`).
- Keep the body unchanged (Wave 6 will add the logical DB modal trigger; this wave's scope is the refactor only).

### 3-2. Create `ConnectionVerifiedStep` (Step 6)

Create `app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionVerifiedStep.tsx`:

```typescript
'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ClockIcon } from '@/app/components/ui/icons';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface ConnectionVerifiedStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const ConnectionVerifiedStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: ConnectionVerifiedStepProps) => (
  <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>
            완료 여부 관리자 승인 대기
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다.
          </p>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          statusColors.warning.bg,
          statusColors.warning.textDark,
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
          승인 대기
        </span>
      </header>
      <div className="p-6">
        <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">최종 관리자 승인을 기다리고 있어요.</strong>
          {' '}승인이 완료되면 모니터링이 즉시 시작됩니다.
        </StepBanner>
        <ConfirmedResourcesSlot />
      </div>
    </section>
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
```

Notes:
- Reuses `ConfirmedResourcesSlot` (read-only confirmed integration table) from the existing layout layer.
- Does **not** render `ConnectionTestSlot` — Step 6 is post-test, read-only.
- A retest button is **not** added in this wave. It belongs to Wave 5 (when we wire the "연결 테스트 재실행" action and decide where the retest CTA lives across Step 6 / Step 7).

### 3-3. Create `InstallationCompleteStep` (Step 7) — minimal shell

Create `app/integration/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep.tsx`:

```typescript
'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface InstallationCompleteStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const InstallationCompleteStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: InstallationCompleteStepProps) => (
  <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>
            PII 모니터링 모듈 연동 완료
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            PII가 사용되어 있을 가능성이 있어요. 사용 단어 빈도가 표시되며, 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
          </p>
        </div>
        {/* Wave 5 fills the status badge slot here */}
      </header>
      <div className="p-6">
        <ConfirmedResourcesSlot />
        {/* Wave 5 fills the action row (인프라 변경 / 연결 테스트 재실행) here */}
      </div>
    </section>
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
```

Notes:
- Wave 5 adds the "Healthy/Unhealthy" badge and the action row. This wave only lands the shell so the switch can route there.
- The Step 7 confirmed table still renders with the current `ConfirmedIntegrationTable` columns (no logical DB count yet — Wave 5 enriches the table).

### 3-4. `CloudTargetSourceLayout` — update switch

Replace the merged case:

```typescript
case ProcessStatus.WAITING_CONNECTION_TEST:
  return <WaitingConnectionTestStep {...props} />;
case ProcessStatus.CONNECTION_VERIFIED:
  return <ConnectionVerifiedStep {...props} />;
case ProcessStatus.INSTALLATION_COMPLETE:
  return <InstallationCompleteStep {...props} />;
```

Update imports at the top of the file.

Removed:
```typescript
import { ConnectionTestStep } from '@/app/integration/.../ConnectionTestStep';
```

Added:
```typescript
import { WaitingConnectionTestStep } from '@/app/integration/.../WaitingConnectionTestStep';
import { ConnectionVerifiedStep } from '@/app/integration/.../ConnectionVerifiedStep';
import { InstallationCompleteStep } from '@/app/integration/.../InstallationCompleteStep';
```

### 3-5. Tests — update + add

- `WaitingConnectionTestStep.test.tsx` (renamed) — assertions referencing `ConnectionTestStep` symbol get updated to `WaitingConnectionTestStep`. Functional assertions stay.
- `ConnectionVerifiedStep.test.tsx` — new file:
  - When `processStatus === CONNECTION_VERIFIED`, the layout switch renders `ConnectionVerifiedStep`.
  - The banner "최종 관리자 승인을 기다리고 있어요" is in the DOM.
  - The status pill "승인 대기" renders.
  - The `ConfirmedResourcesSlot` is mounted.
- `InstallationCompleteStep.test.tsx` — new file:
  - When `processStatus === INSTALLATION_COMPLETE`, the layout switch renders `InstallationCompleteStep`.
  - The title "PII 모니터링 모듈 연동 완료" is in the DOM.
  - `ConfirmedResourcesSlot` mounts.
- `CloudTargetSourceLayout.coverage.test.tsx` — update the case map so all 7 `ProcessStatus` values resolve to the correct step component.

### 3-6. Mock fixtures — ensure all three states exist

Check whether `lib/mock-data.ts` contains target sources at `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE`:

```bash
grep -nE "WAITING_CONNECTION_TEST|CONNECTION_VERIFIED|INSTALLATION_COMPLETE" lib/mock-data.ts
```

If any of the three is missing, add one mock target source per missing state. Do not modify existing seeded data — only append. Use placeholder names (`mock-conn-verified`, `mock-install-complete`) and reuse identifiers from existing fixtures.

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- `ConfirmedIntegrationTable.tsx` — column changes are Wave 5.
- `ConnectionTestPanel.tsx` — Wave 5/6 will adjust if needed; not in this wave.
- BFF schemas, route handlers, swagger.
- Wave 0/1/2/3 surfaces.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/
npm test --run app/integration/target-sources
```

Browser:
- For each of `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, `INSTALLATION_COMPLETE`, load a mock target source. Verify:
  - Step 5 (WAITING_CONNECTION_TEST) renders the existing ConnectionTestPanel.
  - Step 6 (CONNECTION_VERIFIED) renders the new banner + read-only confirmed table. No retest button visible.
  - Step 7 (INSTALLATION_COMPLETE) renders the title and confirmed table. No Healthy badge yet (Wave 5).

Stepper guard:
```bash
git diff --name-only origin/main | grep -E "ProcessProgressBar|StepProgressBar|InstallationProcessProgressBar|stepperMotion" && echo "✗" || echo "✓"
```

## Step 6: Commit + push + PR

```bash
git add app/integration/target-sources/'[targetSourceId]'/_components/layout/

# If mock fixtures were touched
git add lib/mock-data.ts

git commit -m "refactor(target-source-layout): split steps 5/6/7 (wave4)

Replace the merged ConnectionTestStep with three named step components:
WaitingConnectionTestStep (5), ConnectionVerifiedStep (6),
InstallationCompleteStep (7).

Step 6 ships with banner + read-only confirmed table. Step 7 ships
the shell only; visual fill (Healthy badge, action row, logical DB
counts) is Wave 5.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin refactor/sit-detail-wave4-step-split
```

PR body:
```
## Summary

Wave 4 of the target-source detail prototype migration. Splits the
merged Step 5/6/7 component into three named step components so each
step owns its layout.

## Why

The prototype's `screen-4` shows three visually distinct cards for
WAITING_CONNECTION_TEST, CONNECTION_VERIFIED, and INSTALLATION_COMPLETE.
The current single component cannot represent that without a brittle
internal switch.

## Changes

- `ConnectionTestStep.tsx` → renamed `WaitingConnectionTestStep.tsx`.
- `ConnectionVerifiedStep.tsx` — new, Step 6 banner + read-only table.
- `InstallationCompleteStep.tsx` — new, Step 7 shell (visual fill in
  Wave 5).
- `CloudTargetSourceLayout.tsx` — switch fan-out updated.
- Mock fixtures: ensure all three states have at least one seeded
  target source (only when missing).
- Tests: `ConnectionTestStep.test.tsx` renamed to match new component;
  new test files for the two added components.

## Deliberately excluded

- Step 7 Healthy/Unhealthy badge → Wave 5
- Step 7 action row → Wave 5
- Step 7 logical DB count columns → Waves 5 + 6 (column shape + data)
- Step 5 logical DB modal trigger → Wave 6
- ProcessStatus stepper changes (ADR-014 R3 freeze)

## Test plan
- [x] tsc / lint / unit tests green
- [x] CloudTargetSourceLayout coverage test maps all 7 ProcessStatus
      values
- [x] Mock fixtures cover all 7 ProcessStatus values
- [x] Manual visual check on /integration/target-sources/<one per
      state>
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] `CloudTargetSourceLayout.coverage.test.tsx` maps all 7 `ProcessStatus` values
- [ ] `ConfirmedResourcesSlot` still mounted under `ConfirmedIntegrationDataProvider` in steps 5, 6, 7
- [ ] `RejectionAlert` still rendered on steps 5, 6, 7
- [ ] No retest button added in this wave (Wave 5 owns it)
- [ ] Stepper four-file guard passes
- [ ] Mock fixtures cover all 7 states

## Acceptance for this wave

Wave 4 is correct when:
- The 7 `ProcessStatus` values each route to exactly one named step component.
- `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, `INSTALLATION_COMPLETE` render distinct cards visible in the browser.
- All existing unit tests pass (renamed file imports updated).
- Stepper four-file guard passes.
