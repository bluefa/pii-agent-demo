# W4-a — GuideCard Split (Pure + Container)

> **Recommended model**: **Opus 4.7 MAX** (refactor + AST 통합 + 5 use site 사전 정리 + GuideCardInvalidState 통합)
> **Estimated LOC**: ~300
> **Branch prefix**: `refactor/guide-cms-w4a-guidecard-split`
> **Depends on**: W1-b (validator + AST renderer, merged), W1-c (useGuide, merged)

## Context

기존 `GuideCard.tsx` 가 `currentStep / provider / installationMode` 받아 내부에서 `getProcessGuide()` 로 데이터 조회 + 렌더 둘 다 함. 이를 분리:

- **`<GuideCard content={html} />`** — pure presentational. AST renderer 사용. invalid 시 `<GuideCardInvalidState>`.
- **`<GuideCardContainer slotKey={...} />`** — 데이터 fetch (`useGuide`) + lang 결정 + `<GuideCard>` 호출.

5 provider 페이지의 호출부는 **W4-b** 에서 교체. 이번 wave 는 분리 + 새 컴포넌트 노출만.

Spec: `docs/reports/guide-cms/spec.md` §6.5 미리보기 패널 + ADR-010 § Impact on existing code

## Precondition

```bash
[ -f lib/utils/validate-guide-html.ts ] || { echo "✗ W1-b 미머지"; exit 1; }
[ -f app/hooks/useGuide.ts ] || { echo "✗ W1-c 미머지"; exit 1; }
[ -f app/components/features/process-status/GuideCard.tsx ] || { echo "✗ GuideCard 누락"; exit 1; }
grep -q "currentStep" app/components/features/process-status/GuideCard.tsx || { echo "✗ already refactored"; exit 1; }
```

## Required reading

1. `app/components/features/process-status/GuideCard.tsx` (현재 전체)
2. `lib/utils/validate-guide-html.ts` + `app/components/features/process-status/GuideCard/render-guide-ast.tsx` (W1-b)
3. `lib/constants/guide-registry.ts` (W1-a — slot resolver)
4. `app/hooks/useGuide.ts` (W1-c)
5. 5 provider 페이지의 GuideCard 사용처:
   - `app/projects/[projectId]/aws/AwsProjectPage.tsx`
   - `app/projects/[projectId]/azure/AzureProjectPage.tsx`
   - `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
   - `app/projects/[projectId]/idc/IdcProjectPage.tsx`
   - `app/projects/[projectId]/sdu/SduProjectPage.tsx`

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w4a-guidecard-split --prefix refactor
```

## Step 2: 디렉토리 재구성

```
app/components/features/process-status/
├── GuideCard.tsx                          (메인 — 호환 유지 + container 로 변경)
└── GuideCard/
    ├── GuideCardPure.tsx                  (신규 — content prop)
    ├── GuideCardContainer.tsx             (신규 — slotKey prop)
    ├── GuideCardInvalidState.tsx          (신규)
    ├── render-guide-ast.tsx               (W1-b 에서 이미 생성)
    └── index.ts                           (re-exports)
```

## Step 3: GuideCardPure (presentational)

### `app/components/features/process-status/GuideCard/GuideCardPure.tsx` (~80 LOC)

```tsx
import { cn, cardStyles } from '@/lib/theme';
import { GuideIcon } from '@/app/components/ui/icons';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import { renderGuideAst } from './render-guide-ast';
import { GuideCardInvalidState } from './GuideCardInvalidState';

interface Props {
  content: string;       // HTML 문자열
  showHeader?: boolean;  // default true
  invalidVariant?: 'admin' | 'enduser';  // default 'enduser'
}

export function GuideCardPure({ content, showHeader = true, invalidVariant = 'enduser' }: Props) {
  const result = validateGuideHtml(content);
  if (!result.valid) {
    return <GuideCardInvalidState errors={result.errors} variant={invalidVariant} />;
  }
  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cardStyles.warmVariant.container)}>
      {showHeader && <CardHeader />}  {/* 기존 GuideCard 의 header — "가이드" + 아이콘 */}
      <div className="px-6 py-5 prose-guide text-[13px] text-gray-600 leading-[1.72]">
        {renderGuideAst(result.ast)}
      </div>
    </div>
  );
}
```

`prose-guide` 클래스 — `@tailwindcss/typography` prose 기반 + 로컬 오버라이드 (h4/p/ul/ol 시각이 기존 GuideCard 와 동일하게). 별도 CSS 파일 또는 `tailwind.config.ts` 의 `typography` plugin 설정.

## Step 4: GuideCardContainer

### `app/components/features/process-status/GuideCard/GuideCardContainer.tsx` (~80 LOC)

```tsx
'use client';
import { useGuide } from '@/app/hooks/useGuide';
import { resolveSlot } from '@/lib/constants/guide-registry';
import type { GuideSlotKey } from '@/lib/types/guide';
import { GuideCardPure } from './GuideCardPure';
import { GuideCardSkeleton } from './GuideCardSkeleton';
import { GuideCardError } from './GuideCardError';

interface Props {
  slotKey: GuideSlotKey;
  lang?: 'ko' | 'en';  // default 'ko' — 향후 i18n 도입 시 context 에서 derive
}

export function GuideCardContainer({ slotKey, lang = 'ko' }: Props) {
  const slot = resolveSlot(slotKey);
  const { data, loading, error } = useGuide(slot.guideName);
  
  if (loading) return <GuideCardSkeleton />;
  if (error)   return <GuideCardError onRetry={/* refresh */} />;
  if (!data)   return null;
  
  const html = data.contents[lang];
  if (!html.trim()) return <GuideCardEmptyLang lang={lang} />;
  
  return <GuideCardPure content={html} />;
}
```

GuideCardSkeleton / GuideCardError / GuideCardEmptyLang — 작은 보조 컴포넌트 (~20 LOC 씩).

## Step 5: GuideCardInvalidState

### `app/components/features/process-status/GuideCard/GuideCardInvalidState.tsx` (~50 LOC)

W3-d 가 admin variant 에서 사용. 이번 wave 에 만들어두면 W3-d 가 import 만 하면 됨.

```tsx
import type { ValidationError } from '@/lib/utils/validate-guide-html';

interface Props {
  errors: ValidationError[];
  variant?: 'admin' | 'enduser';
}

export function GuideCardInvalidState({ errors, variant = 'enduser' }: Props) {
  if (variant === 'enduser') {
    return <div className="rounded-xl border ..."><p>가이드를 불러올 수 없습니다.</p></div>;
  }
  // admin: mono 폰트로 errors 노출
  return (
    <div className="rounded-xl border ...">
      <p>가이드 콘텐츠 검증 실패:</p>
      <pre className="text-xs font-mono">
        {errors.map(e => `${e.code}: ${e.message}${e.path ? ` (${e.path})` : ''}`).join('\n')}
      </pre>
    </div>
  );
}
```

## Step 6: 기존 GuideCard.tsx — backward compatible facade

### `app/components/features/process-status/GuideCard.tsx` (덮어쓰기 ~70 LOC)

기존 import path (`@/app/components/features/process-status/GuideCard`) 유지하기 위해 facade 로 변환:

```tsx
'use client';
import { GuideCardContainer } from './GuideCard/GuideCardContainer';
import { GuideCardPure } from './GuideCard/GuideCardPure';
import { resolveProcessStepSlotKey } from './GuideCard/resolve-step-slot';  // 신규
import type { ProcessStatus, AwsInstallationMode, CloudProvider } from '@/lib/types';

interface LegacyProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: AwsInstallationMode;
}

/**
 * Backward compatible — 5 provider 페이지가 W4-b 에서 직접 GuideCardContainer 로 교체될 때까지
 * 이 facade 가 slot key 를 resolve 해서 새 container 를 호출한다.
 */
export function GuideCard(props: LegacyProps) {
  const slotKey = resolveProcessStepSlotKey(props.provider, props.currentStep, props.installationMode);
  if (!slotKey) return null;  // IDC/SDU 미지원 step
  return <GuideCardContainer slotKey={slotKey} />;
}

// W4-b 가 끝나면 이 facade 를 제거하고 5 페이지가 직접 GuideCardContainer 호출.
```

### `app/components/features/process-status/GuideCard/resolve-step-slot.ts` (~50 LOC)

```ts
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import type { GuideSlotKey } from '@/lib/types/guide';
import type { ProcessStatus, AwsInstallationMode, CloudProvider } from '@/lib/types';

export function resolveProcessStepSlotKey(
  provider: CloudProvider,
  step: ProcessStatus,
  installationMode?: AwsInstallationMode,
): GuideSlotKey | null {
  if (provider === 'AWS') {
    const variant = installationMode === 'MANUAL' ? 'manual' : 'auto';
    return `process.aws.${variant}.${step}` as GuideSlotKey;
  }
  if (provider === 'AZURE' || provider === 'GCP') {
    return `process.${provider.toLowerCase()}.${step}` as GuideSlotKey;
  }
  // IDC / SDU — 이번 스코프 외, slot 없음
  return null;
}
```

## Step 7: 기존 use site 영향 확인

5 provider 페이지가 그대로 빌드되는지:

```bash
npx tsc --noEmit
grep -rn "GuideCard" app/projects/ | grep -v "// "
```

prop signature `{ currentStep, provider, installationMode }` 가 facade 로 보존되어야 함. 시각도 동일.

## Step 8: 검증

```bash
npx tsc --noEmit
npm run lint -- app/components/features/process-status/
npm run test:run -- guide-card render-guide-ast resolve-step-slot
bash scripts/dev.sh
# 브라우저:
# - /integration/projects/<id>/aws — AWS GuideCard 시각 동일
# - /integration/projects/<id>/azure — AZURE GuideCard 시각 동일
# - GCP / IDC / SDU 동일 확인
# - 깜빡임 없음 (skeleton 즉시 표시 → content 렌더)
```

## Out of scope

- 5 provider 페이지가 직접 `GuideCardContainer` 호출하도록 변경 → W4-b
- 기존 `lib/constants/process-guides.ts` `DEFAULT_STEP_GUIDES` 제거 → W4-b 와 함께
- Admin 미리보기에서 GuideCardPure 사용 → W3-c

## PR body checklist

- [ ] `GuideCardPure` (content prop) + `GuideCardContainer` (slotKey prop) 신규
- [ ] `GuideCard.tsx` facade — 5 use site backward compat
- [ ] `GuideCardInvalidState` (admin / enduser variant)
- [ ] `dangerouslySetInnerHTML` 사용 안 함 — `renderGuideAst` 만
- [ ] 5 provider 페이지 시각 동일 (dev smoke 확인)
- [ ] tsc 0, lint 0
