# W4-b — 3 provider 페이지 마이그레이션 + DEFAULT_STEP_GUIDES / guide-field 타입 제거

> **Recommended model**: Sonnet 4.6 (호출부 교체 + dead code 제거)
> **Estimated LOC**: ~250 (대부분 -/+ diff)
> **Branch prefix**: `refactor/guide-cms-w4b-providers-migrate`
> **Depends on**: W4-a, W3-c (둘 다 merged)

## Context

AWS / Azure / GCP 3 provider 페이지의 `<GuideCard currentStep={} provider={} installationMode={} />` 호출을 `<GuideCardContainer slotKey={...} />` 로 직접 교체. W4-a 에서 유지했던 `GuideCard.tsx` facade 제거. 동시에 `DEFAULT_STEP_GUIDES` (GuideCard warm body 전용 데이터) 와 `guide` 필드 관련 타입 전부 제거.

> ⚠️ IDC / SDU 는 이번 스코프에 포함되지 않음 — 두 페이지는 provider-specific `<GuideCard>` consumer 가 아니며 `app/integration/target-sources/[targetSourceId]/_components/` 아래 `idc/` / `sdu/` 디렉터리 구조 자체가 다르다. Step 구조 확정 후 별도 wave 에서 다룬다.

> ⚠️ **DEFAULT_STEP_GUIDES 는 dead code 다**. `ProcessGuideModal` 이 의존하는 것은 provider-별 step 객체 (`AWS_AUTO_GUIDE`, `AWS_MANUAL_GUIDE`, `AZURE_GUIDE`, `GCP_GUIDE`) 의 `procedures / warnings / notes / prerequisiteGuides` 필드이지 `DEFAULT_STEP_GUIDES` 자체가 아님. `DEFAULT_STEP_GUIDES` 는 오직 warm GuideCard body 렌더용 데이터이므로 `guide` 필드를 제거하면 참조처가 0 이 된다.

Spec: `docs/reports/guide-cms/spec.md` §7.3 + ADR-010 § Impact on existing code

## Precondition

```bash
# W4-a 머지 확인
[ -f app/components/features/process-status/GuideCard/GuideCardContainer.tsx ] || { echo "✗ W4-a 미머지"; exit 1; }
grep -q "currentStep" app/components/features/process-status/GuideCard.tsx || { echo "✗ facade 부재"; exit 1; }

# W3-c 머지 확인 — W3-c 가 GuideCardPure 를 직접 import 하므로 facade 제거 전에 반드시 머지되어 있어야 함
grep -rn "GuideCardPure" app/integration/admin/guides 2>/dev/null | grep -q "." || { echo "✗ W3-c 미머지 — GuideCardPure consumer 부재"; exit 1; }
```

> **Sequencing**: W4-b 는 W3-c 와 **병렬 실행 금지**. W3-c 가 `GuideCardPure` 를 직접 사용하고, W4-b 는 legacy `GuideCard.tsx` facade 를 제거한다. W3-c 가 먼저 머지되어야 W4-b 의 facade 제거가 W3-c 의존성을 깨지 않음. (Codex 리뷰 반영)

## Required reading

1. `app/components/features/process-status/GuideCard.tsx` (W4-a 의 facade — 이번에 제거)
2. 3 provider 페이지 — `<GuideCard>` 호출부:
   - `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx`
3. `lib/constants/process-guides.ts` — `DEFAULT_STEP_GUIDES` (제거 대상 전체) + provider guide 객체 (유지)
4. `lib/types/process-guide.ts` — `ProcessGuideStep.guide?`, `StepGuideContent`, `GuideInline` (제거 대상)
5. `lib/types.ts` — `CloudProvider = 'AWS' | 'Azure' | 'GCP'` (casing 주의: `'Azure'`)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w4b-providers-migrate --prefix refactor
```

## Step 2: 3 provider 페이지 호출부 교체

각 페이지에서 `@/` 절대 경로 import 로 교체:

```tsx
// Before
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
...
<GuideCard
  currentStep={currentStep}
  provider="AWS"
  installationMode={project.awsInstallationMode}
/>

// After
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveProcessStepSlotKey } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
...
const slotKey = resolveProcessStepSlotKey('AWS', currentStep, project.awsInstallationMode);
{slotKey && <GuideCardContainer slotKey={slotKey} />}
```

### 페이지별 resolver 인자

| Page | provider 인자 | installationMode 인자 | slot key 예시 |
|---|---|---|---|
| `aws/AwsProjectPage.tsx` | `'AWS'` | `project.awsInstallationMode` (`'AUTO'` \| `'MANUAL'`) | `process.aws.auto.3` / `process.aws.manual.3` |
| `azure/AzureProjectPage.tsx` | `'Azure'` | `undefined` | `process.azure.<step>` |
| `gcp/GcpProjectPage.tsx` | `'GCP'` | `undefined` | `process.gcp.<step>` |

> `CloudProvider` union 은 `'AWS' \| 'Azure' \| 'GCP'` — 반드시 `'Azure'` (Pascal) 이어야 한다. `'AZURE'` (대문자) 쓰지 말 것.

> `null` slot key (현재 step 에 guide 가 없는 경우) 처리: `{slotKey && <GuideCardContainer ... />}` 패턴으로 렌더 스킵. Placeholder 렌더 X.

## Step 3: GuideCard.tsx facade 제거

W3-c 가 이미 merged 이고 `GuideCardPure` 를 직접 import 하므로 facade 는 더 이상 필요 없음:

```bash
rm app/components/features/process-status/GuideCard.tsx
```

Re-export 유지 금지 — signature 가 달라져 (`slotKey` vs `currentStep/provider/installationMode`) backward compat 이 불가능하다.

## Step 4: Dead code 제거 — DEFAULT_STEP_GUIDES + guide-field 타입

Step 2 교체 후 `guide` 필드 참조는 코드베이스 전체에서 0 이 되어야 한다. 이 시점에서 다음을 **전부** 제거:

### 4.1 `lib/constants/process-guides.ts`

- `DEFAULT_STEP_GUIDES` 상수 제거 (warm GuideCard body 데이터 — 완전 dead)
- 각 provider guide 객체 (`AWS_AUTO_GUIDE`, `AWS_MANUAL_GUIDE`, `AZURE_GUIDE`, `GCP_GUIDE`) 의 step 객체에서 `guide` 필드만 제거
- `procedures / warnings / notes / prerequisiteGuides` 필드는 **유지** — `ProcessGuideModal` 이 의존
- `getProcessGuide()` 함수는 유지 — `ProcessGuideModal` 호출

### 4.2 `lib/types/process-guide.ts`

```ts
// 제거
export type GuideInline = ...;
export interface StepGuideContent { ... }

// ProcessGuideStep 에서
export interface ProcessGuideStep {
  // ...
  guide?: StepGuideContent;  // ← 이 필드 제거
  procedures: ...;           // ← 유지
  warnings: ...;             // ← 유지
  notes: ...;                // ← 유지
  prerequisiteGuides?: ...;  // ← 유지
}
```

### 4.3 Orphan import 정리

Step 4.1/4.2 후 남은 orphan import (unused) 를 각 consumer 에서 제거. 자기 자신 (`process-guides.ts` / `process-guide.ts`) 내부의 남은 self-ref 도 함께 정리.

## Step 5: 검증 — 시각 동일성 + dead code grep

```bash
npx tsc --noEmit
npm run lint
npm run build
bash scripts/dev.sh
```

Dev smoke (3 provider 페이지):
- `/integration/target-sources/<id>/aws` — AUTO 및 MANUAL 양쪽 모드 — GuideCard 시각이 W4-a 머지 직후와 동일
- `/integration/target-sources/<id>/azure`
- `/integration/target-sources/<id>/gcp`

각 페이지에서:
- GuideCard body 가 변경 전과 동일하게 렌더되는지 확인 (regression 없음)
- `ProcessGuideModal` 을 열어 `procedures / warnings / notes` 가 여전히 출력되는지 확인

### Dead code grep (expected 0 hits)

```bash
grep -rn "DEFAULT_STEP_GUIDES" --include="*.ts" --include="*.tsx" . \
  | grep -v "process-guides.ts\b"
# → 0 건. process-guides.ts 내부 남은 self-ref 도 Step 4.3 에서 정리됨.

grep -rn "StepGuideContent\|GuideInline" --include="*.ts" --include="*.tsx" .
# → 0 건.

grep -rn "\.guide\b" --include="*.ts" --include="*.tsx" app/integration/target-sources \
  | grep -i "StepGuide\|DEFAULT_STEP"
# → 0 건.
```

## Out of scope

- IDC / SDU GuideCard 도입 → Step 구조 확정 후 별도 wave
- `ProcessGuideModal` 자체 CMS 화 → 향후 별도 wave
- Admin UI 통합 테스트 (E2E) → W5

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W4-b-providers-migrate.md` @ <SHA>
- Wave: W4-b
- 의존: W4-a, W3-c (merged)

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] npm run build — exit 0 (UI/route 영향 시)
- [ ] Dev smoke — 3 provider 페이지 (AWS AUTO/MANUAL, Azure, GCP) + ProcessGuideModal regression

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```

## PR body checklist

- [ ] AWS / Azure / GCP 3 페이지 모두 `<GuideCardContainer>` 직접 호출 (facade 의존 제거)
- [ ] `'Azure'` casing 확인 (`'AZURE'` 금지)
- [ ] 모든 import `@/` 절대 경로
- [ ] `app/components/features/process-status/GuideCard.tsx` facade 파일 삭제
- [ ] `DEFAULT_STEP_GUIDES` 상수 완전 제거
- [ ] `ProcessGuideStep.guide?` 필드 제거
- [ ] `StepGuideContent`, `GuideInline` 타입 완전 제거
- [ ] Step 5 dead code grep 3종 모두 0 건
- [ ] `ProcessGuideModal` 동작 regression 없음 (`procedures / warnings / notes` 정상 출력)
- [ ] 3 페이지 dev smoke — GuideCard 시각 W4-a 와 동일
- [ ] `tsc` 0, `npm run lint` 0, `npm run build` 0
