# S2-W1c — Frontend Table Rewrite (WaitingApprovalStep)

> **Recommended model**: Sonnet 4.6
> **Estimated LOC**: ~280 (~200 component + ~80 tests)
> **Branch prefix**: `feat/sit-step2-w1c-frontend-table`
> **Depends on**: S2-W1b (merged)

## Context

Step 2 화면의 메인 카드 (테이블 + banner) 를 시안 그대로 옮기는 작업.

현재 구현은 `WaitingApprovalStep.tsx` 가 `CandidateResourceSection`(readonly 모드) 를 재사용해서 Step 2 표를 렌더링한다. 시안은 **Step 2 전용 테이블** 이며 컬럼/카피/레이아웃이 다르다.

본 wave 에서는:

1. Step 2 전용 dedicated table 컴포넌트 신규 생성.
2. 시안 line 1535–1610 의 layout / copy / column / 데이터 표시를 1:1 옮긴다.
3. `WaitingApprovalStep.tsx` 를 새 컴포넌트로 교체.
4. Cancel 버튼 / RejectionAlert 영역은 **placeholder slot** 만 마련 (실제 wiring 은 W1d / W1e).

⛔ **시안 영역 침범 금지** — 새 컴포넌트는 Step 2 만 사용. 다른 step 에서 재사용 금지.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q "systemResetApprovalRequest" lib/bff/client.ts || { echo "✗ S2-W1b 미머지"; exit 1; }
grep -q "scan_status" lib/bff/mock/confirm.ts || { echo "✗ scan_status mock 미반영"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.tsx ] || { echo "✗ 기존 컴포넌트 부재"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1535–1610 — **시각/카피 단일 source of truth**
2. `design/app/SIT Prototype v2.html` line 533–580 (`.stepper`) — Step 2 가 current 일 때의 stepper 표현 (수정 대상 아님, 이미 ProcessStatusCard 가 처리)
3. `design/app/SIT Prototype v2.html` line 800–815 (`.step-banner`) — banner 디자인 토큰
4. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx` (수정 대상)
5. `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable.tsx` (참고 only — 재사용 금지)
6. `lib/theme.ts` — Tailwind 토큰
7. `lib/types.ts` — `ApprovalRequestLatestResponse`, `ResourceScanStatus`, `ResourceIntegrationStatus`
8. `app/lib/api/index.ts` — `getApprovalRequestLatest` (W1b 확인)
9. `docs/reports/sit-step2/00-README.md` §7 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1c-frontend-table --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1c-frontend-table
```

## Step 2: 컴포넌트 트리 설계

```
WaitingApprovalStep (기존, 본 wave 에서 재구성)
├── ProjectPageMeta              (기존 유지)
├── ProcessStatusCard            (기존 유지 — stepper 자체)
└── WaitingApprovalCard          (✨ 신규)
    ├── card-header
    │   ├── title group (h2 + sub)
    │   └── status pill (`승인 대기`)
    ├── card-body
    │   ├── StepBanner           (✨ 신규 — 재사용 가능 컴포넌트)
    │   ├── WaitingApprovalTable (✨ 신규 — Step 2 전용)
    │   └── action footer (slot)
    │        └── cancel button slot   ← W1d 가 채움
    │        └── re-select button slot ← W1e 가 채움
└── RejectionAlert                  (기존, W1e 가 확장)
```

⛔ `CandidateResourceSection` / `CandidateResourceTable` 은 본 wave 에서 import / 수정 금지.

## Step 3: `StepBanner` 컴포넌트 신규 생성

### 위치: `app/components/ui/StepBanner.tsx` (~80 LOC)

재사용 가능한 banner. Step 2 외 Step 6 / 다른 안내에도 쓸 수 있게 variant prop 노출.

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/theme';

type BannerVariant = 'info' | 'warn' | 'success' | 'error';

interface StepBannerProps {
  variant?: BannerVariant;
  icon?: ReactNode;        // 시안: clock / info SVG (Step 2 는 clock)
  children: ReactNode;
}

const variantStyles: Record<BannerVariant, string> = {
  info:    'bg-blue-50    border-blue-200    text-blue-900',
  warn:    'bg-amber-50   border-amber-300   text-amber-900',
  success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  error:   'bg-red-50     border-red-200     text-red-900',
};

export const StepBanner = ({ variant = 'info', icon, children }: StepBannerProps) => (
  <div
    className={cn(
      'flex items-center gap-3 px-4 py-3 mb-4',
      'rounded-[10px] border text-[13px]',
      variantStyles[variant],
    )}
  >
    {icon && <span className="flex-shrink-0">{icon}</span>}
    <div>{children}</div>
  </div>
);
```

⛔ raw hex 사용 금지. Tailwind 색상 클래스만. `rounded-[10px]` 는 시안 정합 — `rounded-lg` (8px) 와 다름에 주의.

### Step 2 사용 예 (시안 line 1548–1554)

```tsx
<StepBanner
  variant="info"
  icon={<ClockIcon className="w-[18px] h-[18px]" />}
>
  <strong className="font-semibold">관리자 승인을 기다리고 있어요.</strong>
  {' '}평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
</StepBanner>
```

## Step 4: `WaitingApprovalTable` 컴포넌트 신규

### 위치: `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx` (~120 LOC)

#### 4.1. Props

```ts
interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;       // "MySQL", "PostgreSQL", ...
  region: string;
  databaseName: string;
  selected: boolean;          // true → "대상", false → "비대상"
  scanStatus?: ResourceScanStatus;
  // exclusionReason 은 시안에서 사용하지 않음 (00-README §7.1)
}

interface WaitingApprovalTableProps {
  resources: WaitingApprovalResource[];
}
```

#### 4.2. 컬럼 (시안 line 1559–1568 그대로)

| # | 헤더 | 데이터 source | null 처리 |
|---|---|---|---|
| 1 | `#` | row index (1-based) | — |
| 2 | `DB Type` | `<TagBadge variant="info">{resourceType}</TagBadge>` | 항상 값 있음 |
| 3 | `Resource ID` | `<span class="font-mono text-[12px]">` | 항상 값 있음 |
| 4 | `Region` | `<span class="font-mono text-[12px]">` | 항상 값 있음 |
| 5 | `DB Name` | `<span class="font-mono text-[12px]">` | 항상 값 있음 |
| 6 | `연동 대상 여부` | `selected ? '대상' : '비대상'` | — |
| 7 | `스캔 이력` | `scanStatus === 'NEW_SCAN' ? '신규' : scanStatus === 'UNCHANGED' ? '변경' : '—'` | null/undefined → `—` |

⛔ "연동 대상 여부" 셀에 제외 사유를 inline 으로 표기하지 않는다 (시안 미사용).

#### 4.3. 테이블 시각 (시안 정합)

- 외곽: 카드 안에 `padding=none` 으로 edge-to-edge.
- 헤더: `bg-gray-50 text-[12px] font-semibold text-gray-500 uppercase tracking-wide` + `px-6 py-3`.
- 행: `border-t border-gray-100`. hover `bg-gray-50`.
- 셀: `px-6 py-4 text-[14px]`.

(정확한 클래스는 시안 line 1559–1597 의 inline 스타일에서 추출)

#### 4.4. Empty / Loading / Error 상태

- Loading: 카드 내부에 `<TableSkeleton />` (4 행). 별도 컴포넌트 없으면 inline div 로 처리.
- Empty: `<EmptyState>` — "표시할 리소스가 없습니다" (시안 미정의 — 임시 카피, W1f 에서 한 번 더 검토).
- Error: `<ErrorState>` — 기존 컴포넌트 재사용.

## Step 5: `WaitingApprovalCard` 컴포넌트 신규

### 위치: `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx` (~100 LOC)

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/app/components/ui/Card';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { WaitingApprovalTable } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { getApprovalRequestLatest } from '@/app/lib/api';
// ... (생략)

interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;       // W1d 가 채움
  reselectSlot?: ReactNode;     // W1e 가 채움
}

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
}: WaitingApprovalCardProps) => {
  // Data fetch via app/lib/api helper
  // ... (생략)

  return (
    <Card title="연동 대상 승인 대기" subtitle="요청하신 DB 목록을 관리자가 확인하고 있어요." statusPill="승인 대기">
      <StepBanner variant="info" icon={<ClockIcon />}>
        <strong>관리자 승인을 기다리고 있어요.</strong>
        {' '}평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
      </StepBanner>

      <WaitingApprovalTable resources={resources} />

      {(cancelSlot || reselectSlot) && (
        <div className="flex justify-end items-center gap-2 mt-4">
          {reselectSlot}
          {cancelSlot}
        </div>
      )}
    </Card>
  );
};
```

⛔ 데이터 fetch / 에러 처리는 본 컴포넌트 안에서 처리. Server Component 가 아니라 Client Component (`'use client'`) — `useApiQuery` / `useApiMutation` 훅 사용 (CLAUDE.md `try-catch 직접 작성 금지`).

## Step 6: `WaitingApprovalStep.tsx` 재구성

```tsx
export const WaitingApprovalStep = ({ project, identity, providerLabel, action, onProjectUpdate }: Props) => {
  return (
    <>
      <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />

      {/* 본 wave 에서는 cancelSlot / reselectSlot null. W1d/W1e 가 wiring 추가 */}
      <WaitingApprovalCard targetSourceId={project.targetSourceId} />

      <RejectionAlert project={project} />
    </>
  );
};
```

⛔ 기존 `ApprovalWaitingCard` import 제거하지 말 것 — W1d 에서 cancel modal 통합 후 함께 정리. (orphan 으로 남기는 한 PR 스코프 외 변경 회피)
> 주: 제거 대상은 W1d 의 책임. 본 wave 는 새 컴포넌트 도입까지만.

## Step 7: Tests

### 7.1. `WaitingApprovalTable.test.tsx` (~80 LOC)

- 7개 컬럼 헤더 렌더링 검증
- selected=true → "대상" / selected=false → "비대상"
- scanStatus=NEW_SCAN → "신규" / UNCHANGED → "변경" / null → "—"
- mono 클래스 적용 검증
- 행 개수 / 번호 매김 1-based 검증

### 7.2. `WaitingApprovalCard.test.tsx` (~50 LOC)

- 시안 카피 line-by-line 검증 (regex 또는 textContent)
- banner variant=info 적용
- cancelSlot / reselectSlot 렌더링 위치 검증

## Step 8: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices` 순차.

추가 검증:
- 시안 line 1535–1610 의 한국어 문자열을 grep 으로 컴포넌트 안에서 정확히 발견해야 함:
  ```bash
  grep -F "관리자 승인을 기다리고 있어요" app/components/ app/integration/target-sources/
  grep -F "1영업일" app/components/ app/integration/target-sources/
  grep -F "요청하신 DB 목록을 관리자가 확인하고 있어요" app/components/ app/integration/target-sources/
  ```
- raw hex 검사:
  ```bash
  grep -nE "#[0-9a-fA-F]{3,6}" app/components/ui/StepBanner.tsx app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApproval*.tsx
  ```
  → 0 matches.

## Step 9: Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/ui/ app/integration/target-sources/
npm run test -- WaitingApproval StepBanner
USE_MOCK_DATA=true npm run dev   # 수동 검증: Step 2 로 강제 진입 후 시안과 픽셀 비교
```

## Step 10: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1c-frontend-table.md` @ <SHA>
- Wave: S2-W1c
- 의존: S2-W1b (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1535–1610

## Changed files
- app/components/ui/StepBanner.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx (수정)
- app/components/ui/__tests__/StepBanner.test.tsx (신규)
- 기타 테스트 신규

## Manual verification
- [ ] 시안 (line 1535–1610) 과 옆에 띄워서 픽셀 비교 — 스크린샷 첨부
- [ ] 카피 1:1 일치
- [ ] scan_status null 인 mock 리소스에서 `—` 노출

## Deferred to later waves
- 취소 confirm modal + cancelSlot wiring → S2-W1d
- "다시 선택하기" Primary 버튼 + reselectSlot wiring → S2-W1e
- 픽셀 정합 final pass → S2-W1f
```

## ⛔ 금지

- 시안 카피 변경.
- `CandidateResourceSection` / `CandidateResourceTable` import 또는 수정.
- 다른 Step (1, 3, 4, 5, 6, 7) 의 `*.tsx` 수정.
- raw hex / `any` / 상대 경로 import.
- 신규 토큰 추가 시 `theme.ts` 외부에 정의하지 말 것.
