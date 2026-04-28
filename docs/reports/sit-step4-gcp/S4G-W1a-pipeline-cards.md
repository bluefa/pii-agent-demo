# S4G-W1a — Pipeline Cards (Top Section)

> **Recommended model**: Sonnet 4.6
> **Estimated LOC**: ~280 (~200 component + ~80 tests)
> **Branch prefix**: `feat/sit-step4-gcp-w1a-pipeline-cards`
> **Depends on**: 없음 (단독 진입). 단 S2-W1f 의 `tagStyles` 토큰 미머지 시 임시 inline 클래스 사용 가능 (W1c 가 token 화).

## Context

Step 4 GCP 분기의 **상단 3-card horizontal pipeline** 을 시안에 맞춰 구현.

기존 `GcpStepSummaryRow` (3-column grid, gap-3 분리) → 시안의 **연결된 horizontal pipeline** (gap-0, connector chevron, halo) 로 시각 재구성. 데이터 로직 (`getGcpStepSummary`) 은 그대로 재사용.

사용자 결정 반영:
- **Q4G-3**: 카드 status pill 에 "skip 이 아닌 resource 들의 개수" 노출 — 즉 `진행중 (3/5)` 형식.
- 기존 GCP step labels (`Subnet 생성` / `Service TF 설치` / `BDC TF 설치`) → 시안 그대로의 **긴 라벨** (`Subnet 생성 진행` / `서비스 측 리소스 설치 진행` / `BDC 측 리소스 설치 진행`) 로 교체.
- 카드별 sub-text 신규 추가.

본 wave 에서는:

1. **`InstallTaskPipeline`** 신규 컴포넌트 — 3-card horizontal grid + connector chevron.
2. **`InstallTaskCard`** 신규 컴포넌트 — 카드 1개 단위 (num / title / sub / status pill).
3. **GCP step label / sub 라벨 확장** — `lib/constants/gcp.ts` 에 시안 카피 추가.
4. **`GcpInstallationInline.tsx` 수정** — `GcpStepSummaryRow` 를 `InstallTaskPipeline` 으로 교체.
5. **카드 클릭 → Task Detail Modal open** — 본 wave 에서는 onClick prop 만 노출. 실제 modal 은 W1b.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/process-status/gcp/GcpInstallationInline.tsx ] || { echo "✗ GCP inline 부재"; exit 1; }
[ -f lib/constants/gcp.ts ] || { echo "✗ GCP constants 부재"; exit 1; }
grep -q "GcpStepKey\|getGcpStepSummary" lib/constants/gcp.ts || { echo "✗ getGcpStepSummary 부재"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1726–1753 (GCP pipeline) + line 817–874 (CSS) — 시각 source of truth
2. `app/components/features/process-status/gcp/GcpInstallationInline.tsx` 전체 — 수정 대상
3. `app/components/features/process-status/gcp/GcpStepSummaryRow.tsx` 전체 — 제거 대상
4. `app/components/features/process-status/gcp/GcpStepSummaryCard.tsx` 전체 — 패턴 참고 (제거 대상)
5. `lib/constants/gcp.ts` 전체 — 라벨 / `getGcpStepSummary` 헬퍼
6. `app/api/_lib/v1-types.ts` line 142–179 — `GcpResourceStatus` / `GcpStepStatus` / `GcpStepAggregateStatus` (PENDING 케이스 포함)
7. `lib/theme.ts` — `bgColors` / `textColors` / `tagStyles` (S2-W1f 가 추가했는지 확인) / `statusColors`
8. `docs/reports/sit-step4-gcp/00-README.md` §9 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step4-gcp-w1a-pipeline-cards --prefix feat
cd /Users/study/pii-agent-demo-sit-step4-gcp-w1a-pipeline-cards
```

## Step 2: GCP 라벨 / sub-text 확장 — `lib/constants/gcp.ts`

기존 `GCP_STEP_LABELS` 는 짧은 라벨 (`Subnet 생성`). 시안 라벨은 다름. **본 wave 에서 신규 상수 추가** (기존 짧은 라벨은 다른 곳에서 쓰일 수 있어 보존):

```ts
// 시안 line 1726–1753 의 카피 — Step 4 GCP pipeline 전용
export const GCP_STEP_PIPELINE_LABELS: Record<GcpStepKey, string> = {
  serviceSideSubnetCreation: 'Subnet 생성 진행',
  serviceSideTerraformApply: '서비스 측 리소스 설치 진행',
  bdcSideTerraformApply: 'BDC 측 리소스 설치 진행',
} as const;

export const GCP_STEP_PIPELINE_SUBS: Record<GcpStepKey, string> = {
  serviceSideSubnetCreation: 'Project 내 모니터링용 Subnet (10.30.0.0/22) 생성',
  serviceSideTerraformApply: 'VPC Peering / Firewall / Service Account 권한 위임 구성',
  bdcSideTerraformApply: 'PII Agent GCE 인스턴스 + Service Account + IAM Role 자동 배포',
} as const;
```

⛔ 기존 `GCP_STEP_LABELS` 는 **삭제하지 않는다** (다른 사용처 가능성). grep 으로 사용처 확인 후 결정.

## Step 3: `InstallTaskCard` 컴포넌트 신규

### 위치: `app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx` (~120 LOC)

```tsx
'use client';

import type { ReactNode } from 'react';
import { cn, statusColors, bgColors, textColors, borderColors, tagStyles } from '@/lib/theme';

export type InstallTaskCardStatus = 'done' | 'running' | 'failed' | 'pending';

interface InstallTaskCardProps {
  num: number;                          // 1, 2, 3 ...
  title: string;
  sub?: string;
  status: InstallTaskCardStatus;
  /** Q4G-3: 진행 카운트. running 일 때 "(M/N)" 형식으로 status pill 안에 노출 */
  completedCount?: number;
  activeCount?: number;
  onClick?: () => void;                 // W1b 가 wiring (Task Detail Modal open)
  /** grid 위치 — first 는 left rounded, last 는 right rounded + border-right */
  position: 'first' | 'middle' | 'last';
}

const NUM_STYLES: Record<InstallTaskCardStatus, string> = {
  pending: cn(bgColors.muted, textColors.tertiary),
  done:    'bg-emerald-500 text-white',
  running: 'bg-blue-600 text-white shadow-[0_0_0_4px_rgba(0,100,255,0.15)]',
  failed:  'bg-red-500 text-white',
};

const PILL_STYLES: Record<InstallTaskCardStatus, string> = {
  pending: cn(bgColors.muted, textColors.tertiary),
  done:    tagStyles.success,
  running: tagStyles.info,
  failed:  tagStyles.error,    // 본 wave 에서 tagStyles.error 가 없으면 임시 inline (W1c 가 token 화)
};

const PILL_LABEL: Record<InstallTaskCardStatus, string> = {
  pending: '해당없음',
  done:    '완료',
  running: '진행중',
  failed:  '실패',
};

const POSITION_BORDER: Record<NonNullable<InstallTaskCardProps['position']>, string> = {
  first:  'rounded-l-[10px]',
  middle: '',
  last:   'rounded-r-[10px] border-r',
};

export const InstallTaskCard = ({
  num,
  title,
  sub,
  status,
  completedCount,
  activeCount,
  onClick,
  position,
}: InstallTaskCardProps) => {
  const showCount = status === 'running' && typeof activeCount === 'number';
  const pillText = showCount
    ? `${PILL_LABEL[status]} (${completedCount ?? 0}/${activeCount})`
    : PILL_LABEL[status];

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center text-center gap-3 px-[18px] pt-[22px] pb-5',
        'border border-r-0 bg-white relative',
        borderColors.default,
        POSITION_BORDER[position],
        onClick && 'cursor-pointer hover:bg-gray-50',
      )}
    >
      <span
        className={cn(
          'w-[30px] h-[30px] rounded-full grid place-items-center',
          'text-[13px] font-bold flex-shrink-0',
          NUM_STYLES[status],
        )}
      >
        {num}
      </span>
      <div className="w-full min-w-0 flex flex-col items-center gap-1.5">
        <div className={cn('text-[15px] font-bold leading-snug', textColors.primary)}>
          {title}
        </div>
        {sub && (
          <div className={cn('text-xs leading-relaxed', textColors.tertiary)}>
            {sub}
          </div>
        )}
        <span className={cn(
          'mt-1 text-[11px] font-semibold px-3 py-1 rounded-full',
          PILL_STYLES[status],
        )}>
          {pillText}
        </span>
      </div>
    </Tag>
  );
};
```

⛔ raw hex 금지 — 위 `bg-emerald-500`, `bg-blue-600` 등은 Tailwind class. `[0_0_0_4px_rgba(0,100,255,0.15)]` 같은 arbitrary value 는 W1c 에서 토큰 추출.
⛔ `tagStyles.error` 가 S2-W1f 에 추가되지 않았다면 본 wave 에서 임시 inline (`bg-red-50 text-red-800 border border-red-200`) — W1c 가 정리.

## Step 4: `InstallTaskPipeline` 컴포넌트 신규

### 위치: `app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx` (~80 LOC)

```tsx
'use client';

import { Fragment } from 'react';
import { cn, borderColors, bgColors } from '@/lib/theme';
import { InstallTaskCard, type InstallTaskCardStatus } from './InstallTaskCard';

export interface InstallTaskPipelineItem {
  key: string;
  title: string;
  sub?: string;
  status: InstallTaskCardStatus;
  completedCount?: number;
  activeCount?: number;
  onClick?: () => void;
}

interface InstallTaskPipelineProps {
  items: InstallTaskPipelineItem[];
}

export const InstallTaskPipeline = ({ items }: InstallTaskPipelineProps) => (
  <div className="grid grid-cols-3 gap-0 mb-[18px] relative">
    {items.map((item, idx) => {
      const position = idx === 0 ? 'first' : idx === items.length - 1 ? 'last' : 'middle';
      return (
        <Fragment key={item.key}>
          <InstallTaskCard
            num={idx + 1}
            title={item.title}
            sub={item.sub}
            status={item.status}
            completedCount={item.completedCount}
            activeCount={item.activeCount}
            onClick={item.onClick}
            position={position}
          />
          {/* connector chevron (마지막 카드 다음에는 노출 안 함) */}
          {idx < items.length - 1 && <ConnectorChevron />}
        </Fragment>
      );
    })}
  </div>
);

const ConnectorChevron = () => (
  // 시안 line 836–846 의 ::after — JSX 로 inline. background 흰색 사각형 회전 시각 효과.
  <div
    aria-hidden="true"
    className={cn(
      'absolute top-1/2 w-3.5 h-3.5 bg-white border-t border-r',
      borderColors.default,
      'rotate-45 -translate-y-1/2',
      'pointer-events-none z-10',
    )}
    // position 은 카드 grid 의 분기 지점 — 동적 계산 필요 시 ResizeObserver 또는 grid-column flex 활용
  />
);
```

⚠️ **connector chevron 위치 계산**: 시안은 `::after` pseudo-element 로 카드 사이 chevron 표시. JSX 에서 동일 효과를 내려면 grid 안에서 `absolute` + 동적 left 계산 또는 카드별로 `::after` 같은 효과를 inline 으로. 본 wave 에서는 **단순화** — chevron 을 시각적으로 생략하거나, CSS pseudo-element 를 글로벌 CSS 또는 컴포넌트 모듈 CSS 에 정의.

→ 옵션:
- (a) `app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.module.css` 신규 — `::after` pseudo-element 그대로 이식
- (b) inline 으로 카드 between chevron 을 div 로 그림 (위 코드의 `<ConnectorChevron />`)

**임시 결정**: (b) 단순 inline. 픽셀 정합은 W1c 가 한 번 더 다듬음.

## Step 5: GCP installation status → pipeline items 매핑 헬퍼

### 위치: `lib/constants/gcp.ts` 에 함수 추가 (~30 LOC)

```ts
import type { GcpResourceStatus } from '@/app/api/_lib/v1-types';

export interface GcpPipelineItemBase {
  key: GcpStepKey;
  title: string;
  sub?: string;
  status: 'done' | 'running' | 'failed' | 'pending';
  completedCount?: number;
  activeCount?: number;
}

const AGGREGATE_TO_CARD_STATUS: Record<
  GcpStepAggregateStatus,
  'done' | 'running' | 'failed' | 'pending'
> = {
  COMPLETED: 'done',
  IN_PROGRESS: 'running',
  FAIL: 'failed',
  PENDING: 'pending',
};

export const buildGcpPipelineItems = (
  resources: GcpResourceStatus[],
): GcpPipelineItemBase[] => GCP_STEP_KEYS.map((stepKey) => {
  const summary = getGcpStepSummary(resources, stepKey);
  return {
    key: stepKey,
    title: GCP_STEP_PIPELINE_LABELS[stepKey],
    sub: GCP_STEP_PIPELINE_SUBS[stepKey],
    status: AGGREGATE_TO_CARD_STATUS[summary.status],
    completedCount: summary.completedCount,
    activeCount: summary.activeCount,
  };
});
```

→ 호출부에서 `onClick` 만 추가하여 `InstallTaskPipelineItem` 으로 변환.

## Step 6: `GcpInstallationInline.tsx` 수정

기존 import / render 변경:

```tsx
// ❌ 변경 전
import { GcpStepSummaryRow } from './GcpStepSummaryRow';
// ...
<GcpStepSummaryRow resources={resources} />

// ✅ 변경 후
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { buildGcpPipelineItems } from '@/lib/constants/gcp';

const pipelineItems = buildGcpPipelineItems(resources).map((item) => ({
  ...item,
  // W1b 가 onClick 채움. 본 wave 에서는 undefined.
  onClick: undefined,
}));

// render
<InstallTaskPipeline items={pipelineItems} />
```

⛔ 본 wave 에서 onClick 는 비워둠. W1b 가 채움.

## Step 7: 기존 컴포넌트 제거

```bash
grep -rln "GcpStepSummaryRow\|GcpStepSummaryCard" app/ | grep -v __tests__
```

→ 결과가 `GcpInstallationInline.tsx` 만이면 두 컴포넌트 + 테스트 삭제.
→ 다른 사용처 있으면 deletion 보류.

## Step 8: Tests

### 8.1. `InstallTaskCard.test.tsx` (~50 LOC)

- status별 클래스 적용 (done/running/failed/pending)
- running + activeCount 있을 때 `(M/N)` 형식 노출
- onClick 있을 때 button 으로 렌더 / 없을 때 div
- position 별 rounded class
- title / sub 카피 1:1

### 8.2. `InstallTaskPipeline.test.tsx` (~30 LOC)

- 3개 items 렌더
- connector chevron 카드 사이에 N-1 개

### 8.3. `gcp-pipeline-builder.test.ts` (~40 LOC)

- 모든 resource step 이 COMPLETED → status='done'
- 일부 IN_PROGRESS → status='running' + completedCount/activeCount 정확
- FAIL 1건 → status='failed'
- 모두 SKIP → status='pending'
- title / sub 정확히 매핑

## Step 9: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가:
- 카피 매칭:
  ```bash
  grep -F "Subnet 생성 진행" app/components/features/process-status/install-task-pipeline/ lib/constants/gcp.ts
  grep -F "PII Agent GCE 인스턴스" lib/constants/gcp.ts
  grep -F "VPC Peering / Firewall / Service Account" lib/constants/gcp.ts
  ```
- raw hex 검사 (svg fill/stroke 외):
  ```bash
  grep -nE "#[0-9a-fA-F]{3,6}" app/components/features/process-status/install-task-pipeline/ | grep -v "fill=\"#" | grep -v "stroke=\"#"
  ```
  → arbitrary value `[…rgba…]` 는 일부 허용 (W1c 가 토큰화).
- Provider 영향 없음 검증 — Azure / AWS 컴포넌트 grep 으로 변경 없음 확인:
  ```bash
  git diff --name-only origin/main...HEAD | grep -E "(azure|aws)"
  ```
  → GCP 외 변경 0건 확인.

## Step 10: Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/features/process-status/ lib/constants/gcp.ts
npm run test -- InstallTaskCard InstallTaskPipeline gcp-pipeline-builder
USE_MOCK_DATA=true npm run dev   # 수동: GCP project + ProcessStatus=4 시나리오 진입 후 시안 비교
```

## Step 11: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step4-gcp/S4G-W1a-pipeline-cards.md` @ <SHA>
- Wave: S4G-W1a
- 의존: 없음
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1726–1753 + 817–874 (CSS)

## Changed files
- app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx (신규)
- app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx (신규)
- lib/constants/gcp.ts — `GCP_STEP_PIPELINE_LABELS` / `GCP_STEP_PIPELINE_SUBS` / `buildGcpPipelineItems` 추가
- app/components/features/process-status/gcp/GcpInstallationInline.tsx — `GcpStepSummaryRow` → `InstallTaskPipeline` 교체
- (조건부 삭제) app/components/features/process-status/gcp/GcpStepSummaryRow.tsx
- (조건부 삭제) app/components/features/process-status/gcp/GcpStepSummaryCard.tsx
- 테스트 신규/수정

## Manual verification
- [ ] GCP installing 화면 진입 → 3-card horizontal pipeline 노출
- [ ] running 카드의 status pill 에 `(M/N)` 카운트 노출 (Q4G-3)
- [ ] 시안 픽셀 비교 — 스크린샷 첨부

## Deferred to later waves
- 카드 클릭 → Task Detail Modal open → S4G-W1b
- 공용 DB List 테이블 → S4G-W1b
- 디자인 토큰 정리 (`tagStyles.error` 등) → S4G-W1c
```

## ⛔ 금지

- 시안 카피 변경.
- 기존 `GCP_STEP_LABELS` / `GCP_STEP_STATUS_LABELS` 제거 (다른 사용처 가능).
- BFF 명세 변경 시도 (Q4G-1).
- Provider (Azure/AWS) 컴포넌트 수정.
- Task Detail Modal 신규 작성 (W1b 영역).
- 공용 DB List 테이블 작성 (W1b 영역).
