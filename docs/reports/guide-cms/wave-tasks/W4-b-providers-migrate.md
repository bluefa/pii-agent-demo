# W4-b — Provider Pages Migration + DEFAULT_STEP_GUIDES Cleanup

> **Recommended model**: Sonnet 4.6 (호출부 교체 + dead code 제거)
> **Estimated LOC**: ~250 (대부분 -/+ diff)
> **Branch prefix**: `refactor/guide-cms-w4b-providers-migrate`
> **Depends on**: W4-a (GuideCardContainer + facade, merged)

## Context

5 provider 페이지의 `<GuideCard currentStep={} provider={} installationMode={} />` 호출을 `<GuideCardContainer slotKey={...} />` 로 직접 교체. facade 제거. `DEFAULT_STEP_GUIDES` 의 `guide` 필드 사용처 정리.

> ⚠️ `DEFAULT_STEP_GUIDES` 자체는 제거하지 않음 — `ProcessGuideModal` 이 `procedures / warnings / notes / prerequisiteGuides` 에 여전히 의존. **`guide` 필드만** 제거.

Spec: `docs/reports/guide-cms/spec.md` §7.3 + ADR-010 § Impact on existing code

## Precondition

```bash
[ -f app/components/features/process-status/GuideCard/GuideCardContainer.tsx ] || { echo "✗ W4-a 미머지"; exit 1; }
grep -q "currentStep" app/components/features/process-status/GuideCard.tsx || { echo "✗ facade 부재"; exit 1; }
```

## Required reading

1. `app/components/features/process-status/GuideCard.tsx` (W4-a 의 facade)
2. 5 provider 페이지 — `<GuideCard>` 호출부:
   - `app/projects/[projectId]/aws/AwsProjectPage.tsx`
   - `app/projects/[projectId]/azure/AzureProjectPage.tsx`
   - `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
   - `app/projects/[projectId]/idc/IdcProjectPage.tsx`
   - `app/projects/[projectId]/sdu/SduProjectPage.tsx`
3. `lib/constants/process-guides.ts` — `DEFAULT_STEP_GUIDES` (제거 대상은 `guide` 필드만)
4. `lib/types/process-guide.ts` — `ProcessGuideStep.guide` 타입 (선택 필드로 유지 — modal 사용처가 무관해야)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w4b-providers-migrate --prefix refactor
```

## Step 2: 5 provider 페이지 호출부 교체

각 페이지에서:

```tsx
// Before
<GuideCard
  currentStep={processStatus}
  provider="AWS"
  installationMode={installationMode}
/>

// After
<GuideCardContainer
  slotKey={resolveProcessStepSlotKey('AWS', processStatus, installationMode)!}
/>
```

또는 helper 를 호출부에서:

```tsx
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveProcessStepSlotKey } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';

const slotKey = resolveProcessStepSlotKey('AWS', processStatus, installationMode);
{slotKey && <GuideCardContainer slotKey={slotKey} />}
```

### 페이지별 차이

| Provider | installationMode | slot key |
|---|---|---|
| AWS | `'AUTO'` | `process.aws.auto.<step>` |
| AWS | `'MANUAL'` | `process.aws.manual.<step>` |
| AZURE | (none) | `process.azure.<step>` |
| GCP | (none) | `process.gcp.<step>` |
| IDC | (none) | `null` — slot 없음 → 렌더 X |
| SDU | (none) | `null` — slot 없음 → 렌더 X |

IDC / SDU 는 이번 스코프 밖이라 `slotKey === null` → GuideCard 자리에 placeholder 또는 nothing.

## Step 3: GuideCard.tsx facade 제거

facade 가 더 이상 필요 없으므로:

```bash
rm app/components/features/process-status/GuideCard.tsx
```

대신 같은 경로에 re-export 만 남길지 결정:

```tsx
// app/components/features/process-status/GuideCard.tsx (선택 — backward compat)
export { GuideCardContainer as GuideCard } from './GuideCard/GuideCardContainer';
// 단, signature 가 바뀌었으므로 (slotKey vs currentStep) — 재export 권장 안 함
```

권장: facade 완전 제거 + 외부 사용처는 모두 `GuideCardContainer` 직접 import.

## Step 4: `DEFAULT_STEP_GUIDES.guide` 필드 정리

### `lib/constants/process-guides.ts`

`DEFAULT_STEP_GUIDES[N].guide` 와 모든 provider override 의 `guide` 필드 제거. `procedures / warnings / notes / prerequisiteGuides` 등 ProcessGuideModal 용 필드는 그대로.

```ts
// Before
1: { heading: '...', summary: [...], bullets: [[...]] }

// After (guide 필드 없음)
// stepNumber 별 ProcessGuideStep 에서 guide 키 모두 삭제.
```

### `lib/types/process-guide.ts`

```ts
export interface ProcessGuideStep {
  // ... 기존
  guide?: StepGuideContent;  // 이 필드 제거
}
```

`StepGuideContent` 와 `GuideInline` 타입은 ProcessGuideModal 이 다른 용도로 안 쓰면 함께 제거. 단 `getProcessGuide()` 함수는 ProcessGuideModal 이 여전히 호출하므로 유지.

## Step 5: 검증 — 시각 동일성

```bash
npx tsc --noEmit
npm run lint
bash scripts/dev.sh
```

5 provider 페이지 모두 dev smoke:
- `/integration/projects/<id>/aws?installationMode=AUTO`
- `/integration/projects/<id>/aws?installationMode=MANUAL`
- `/integration/projects/<id>/azure`
- `/integration/projects/<id>/gcp`
- `/integration/projects/<id>/idc` — GuideCard 자리 비어있어야 (또는 placeholder)
- `/integration/projects/<id>/sdu` — 동일

각 페이지에서 GuideCard 시각이 W4-a 머지 직후와 동일한지 확인 (regression 없음).

`ProcessGuideModal` 도 함께 동작 확인 — modal 의 procedures / warnings / notes 가 여전히 출력.

## Step 6: Dead code grep

```bash
grep -rn "DEFAULT_STEP_GUIDES" --include="*.ts" --include="*.tsx" .
# → process-guides.ts 자기 자신 외 0건이어야 함
grep -rn "StepGuideContent\|GuideInline" --include="*.ts" --include="*.tsx" .
# → 제거되어야 할 import 있는지 확인
```

## Out of scope

- IDC / SDU step 정의 → 향후 별도 wave (Step 구조 확정 후)
- ProcessGuideModal 자체 CMS 화 → 향후 별도 wave
- Admin UI 통합 테스트 (E2E) → W5

## PR body checklist

- [ ] 5 provider 페이지 모두 `<GuideCardContainer>` 직접 호출 (facade 의존 제거)
- [ ] `DEFAULT_STEP_GUIDES[*].guide` 필드 모두 제거
- [ ] `ProcessGuideStep.guide?` 필드 제거
- [ ] `StepGuideContent`, `GuideInline` 타입 사용처 0 확인 후 제거
- [ ] `ProcessGuideModal` 동작 regression 없음
- [ ] 5 페이지 dev smoke (각 provider 의 GuideCard 시각 W4-a 와 동일)
- [ ] tsc 0, lint 0
