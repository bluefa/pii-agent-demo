# W4-a — GuideCard Split (Pure + Container) + Invalid/Error/Skeleton/EmptyLang States

> **Recommended model**: **Opus 4.7 MAX** (refactor + AST 통합 + 3 provider 페이지 backward compat + GuideCardInvalidState / Error / Skeleton / EmptyLang 통합)
> **Estimated LOC**: ~400
> **Branch prefix**: `refactor/guide-cms-w4a-guidecard-split`
> **Depends on**: W1-b (validator + AST renderer, merged), W1-c (useGuide, merged)

## Context

기존 `GuideCard.tsx` 가 `currentStep / provider / installationMode` 받아 내부에서 `getProcessGuide()` 로 데이터 조회 + 렌더 둘 다 함. 이를 분리:

- **`GuideCardPure`** — pure presentational. `content: string` 만 받음. AST renderer 사용. invalid 시 `GuideCardInvalidState`.
- **`GuideCardContainer`** — 데이터 fetch (`useGuide`) + lang 결정 + `GuideCardPure` 호출.
- **보조 상태 컴포넌트**: `GuideCardInvalidState`, `GuideCardError`, `GuideCardSkeleton`, `GuideCardEmptyLang` — 이전 W3-d 에서 분리 계획이었으나 W3-d 삭제로 **이번 wave 에 통합**.

3 provider 페이지 (`AwsProjectPage`, `AzureProjectPage`, `GcpProjectPage`) 의 호출부는 **W4-b** 에서 `GuideCardContainer` 로 교체. 이번 wave 는 분리 + 새 컴포넌트 노출 + facade 유지만.

**Scope 경계**: IDC / SDU 는 provider 별 GuideCard 사용처가 없으므로 이번 wave 스코프 외. `CloudProvider` 타입(`'AWS' | 'Azure' | 'GCP'`) 기준으로만 동작.

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
5. 3 provider 페이지의 GuideCard 사용처 (정확한 경로 — `app/projects/...` 아님):
   - `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx`
6. **Out of scope** (GuideCard 미사용):
   - IDC / SDU — 별도 provider 페이지 없음, `CloudProvider` union 에도 없음

경로 검증:
```bash
ls 'app/integration/target-sources/[targetSourceId]/_components/aws/'
ls 'app/integration/target-sources/[targetSourceId]/_components/azure/'
ls 'app/integration/target-sources/[targetSourceId]/_components/gcp/'
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w4a-guidecard-split --prefix refactor
```

## Step 2: 디렉토리 재구성

```
app/components/features/process-status/
├── GuideCard.tsx                          (메인 facade — backward compat, W4-b 까지 유지)
└── GuideCard/
    ├── GuideCardPure.tsx                  (신규 — content prop, stable export)
    ├── GuideCardContainer.tsx             (신규 — slotKey prop, stable export)
    ├── GuideCardInvalidState.tsx          (신규 — admin/enduser variant)
    ├── GuideCardError.tsx                 (신규 — 네트워크/fetch 실패)
    ├── GuideCardSkeleton.tsx              (신규 — loading placeholder)
    ├── GuideCardEmptyLang.tsx             (신규 — 해당 lang 본문 없음)
    ├── resolve-step-slot.ts               (신규 — legacy facade 용 slot key 결정자)
    ├── render-guide-ast.tsx               (W1-b 에서 이미 생성)
    └── index.ts                           (re-exports)
```

## Step 3: GuideCardPure (presentational)

### `app/components/features/process-status/GuideCard/GuideCardPure.tsx` (~80 LOC)

```tsx
import { cn, cardStyles } from '@/lib/theme';
import { GuideIcon } from '@/app/components/ui/icons';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';

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
      <div className={cn('px-6 py-5 prose-guide text-[13px] leading-[1.72]', cardStyles.warmVariant.body)}>
        {renderGuideAst(result.ast)}
      </div>
    </div>
  );
}
```

> `cardStyles.warmVariant.body` — `lib/theme.ts` 의 body 텍스트 토큰. 기존 GuideCard 가 사용하던 토큰 이름이 다르면 (`cardStyles.guide.body` 등) 그 이름으로 교체. raw `text-gray-600` 직접 사용 금지 (CLAUDE.md §4).

`prose-guide` 클래스 — 기존 GuideCard 와 동일한 h4/p/ul/ol 시각을 재현.

> **Note**: 프로젝트에 `@tailwindcss/typography` 플러그인이 설치되어 있지 않을 수 있다. 설치 여부 확인:
> ```bash
> grep "@tailwindcss/typography" package.json || echo "NOT INSTALLED"
> ls tailwind.config.* 2>/dev/null || echo "NO TAILWIND CONFIG FILE"
> ```
> 플러그인이 없으면 `prose` 의존 없이 **`lib/theme.ts` 토큰 + 직접 CSS class 조합**으로 h4/p/ul/ol 시각을 구현한다. 예: `app/globals.css` 에 `.prose-guide h4 { ... }` 같이 로컬 스코프 CSS 작성. 기존 `GuideCard.tsx` 가 이미 사용하던 class 규칙을 그대로 이식한다.

## Step 4: GuideCardContainer

### `app/components/features/process-status/GuideCard/GuideCardContainer.tsx` (~80 LOC)

```tsx
'use client';
import { useGuide } from '@/app/hooks/useGuide';
import { resolveSlot } from '@/lib/constants/guide-registry';
import type { GuideSlotKey } from '@/lib/types/guide';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { GuideCardSkeleton } from '@/app/components/features/process-status/GuideCard/GuideCardSkeleton';
import { GuideCardError } from '@/app/components/features/process-status/GuideCard/GuideCardError';
import { GuideCardEmptyLang } from '@/app/components/features/process-status/GuideCard/GuideCardEmptyLang';

interface Props {
  slotKey: GuideSlotKey;
  lang?: 'ko' | 'en';  // default 'ko' — 향후 i18n 도입 시 context 에서 derive
}

export function GuideCardContainer({ slotKey, lang = 'ko' }: Props) {
  const slot = resolveSlot(slotKey);
  const { data, loading, error, refresh } = useGuide(slot.guideName);

  if (loading) return <GuideCardSkeleton />;
  if (error)   return <GuideCardError onRetry={refresh} />;
  if (!data)   return null;

  const html = data.contents[lang];
  if (!html.trim()) return <GuideCardEmptyLang lang={lang} />;

  return <GuideCardPure content={html} />;
}
```

GuideCardSkeleton / GuideCardError / GuideCardEmptyLang 는 Step 4.5 에 통합 정의.

## Step 4.5: Helper state components (이전 W3-d 에서 이동)

W3-d 가 삭제되어 이 보조 컴포넌트들이 이번 wave 로 통합되었다. 모두 `cn` + `cardStyles` + `lib/theme.ts` 토큰만 사용하고 raw color class (`bg-blue-600`, `text-gray-500` 등) 는 쓰지 않는다.

### `app/components/features/process-status/GuideCard/GuideCardSkeleton.tsx` (~25 LOC)

```tsx
import { cn, cardStyles } from '@/lib/theme';

export function GuideCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('rounded-xl border shadow-sm overflow-hidden animate-pulse', cardStyles.warmVariant.container)}
    >
      <div className="h-10 border-b bg-black/5" />
      <div className="px-6 py-5 space-y-3">
        <div className="h-4 w-3/4 rounded bg-black/10" />
        <div className="h-4 w-5/6 rounded bg-black/10" />
        <div className="h-4 w-2/3 rounded bg-black/10" />
      </div>
    </div>
  );
}
```

### `app/components/features/process-status/GuideCard/GuideCardError.tsx` (~35 LOC)

```tsx
import { cn, cardStyles, primaryColors } from '@/lib/theme';

interface Props {
  onRetry?: () => void;
}

export function GuideCardError({ onRetry }: Props) {
  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cardStyles.warmVariant.container)}>
      <div className="px-6 py-5 space-y-3">
        <p className="text-[13px] font-medium">가이드를 불러오지 못했습니다.</p>
        <p className="text-[12px] opacity-70">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn('inline-flex items-center rounded-md px-3 py-1.5 text-[12px]', primaryColors.bg, primaryColors.hoverBg, 'text-white')}
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
```

### `app/components/features/process-status/GuideCard/GuideCardEmptyLang.tsx` (~20 LOC)

```tsx
import { cn, cardStyles } from '@/lib/theme';

interface Props {
  lang: 'ko' | 'en';
}

export function GuideCardEmptyLang({ lang }: Props) {
  const message = lang === 'ko'
    ? '한국어 본문이 아직 작성되지 않았습니다.'
    : '영어 본문이 아직 작성되지 않았습니다.';
  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cardStyles.warmVariant.container)}>
      <div className="px-6 py-5">
        <p className="text-[13px] opacity-70">{message}</p>
      </div>
    </div>
  );
}
```

> 색상/쉐도우는 모두 `lib/theme.ts` 토큰 (`cardStyles.warmVariant.container`, `primaryColors.bg` 등) 을 통한다. 인라인 raw class (`bg-blue-600`, `bg-red-500`) 는 **금지**. 기존 `GuideCard.tsx` 가 사용하던 토큰 이름을 그대로 가져온다.

## Step 5: GuideCardInvalidState

### `app/components/features/process-status/GuideCard/GuideCardInvalidState.tsx` (~60 LOC)

W3-c (admin preview) 와 GuideCardPure (enduser fallback) 양쪽에서 사용.

```tsx
import { cn, cardStyles } from '@/lib/theme';
import type { ValidationError } from '@/lib/utils/validate-guide-html';

interface Props {
  errors: ValidationError[];
  variant?: 'admin' | 'enduser';
}

export function GuideCardInvalidState({ errors, variant = 'enduser' }: Props) {
  if (variant === 'enduser') {
    return (
      <div className={cn('rounded-xl border shadow-sm overflow-hidden', cardStyles.warmVariant.container)}>
        <div className="px-6 py-5">
          <p className="text-[13px] opacity-70">가이드를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }
  // admin: mono 폰트로 errors 노출 — 에디터가 무엇이 틀렸는지 바로 확인
  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cardStyles.warmVariant.container)}>
      <div className="px-6 py-5 space-y-2">
        <p className="text-[13px] font-medium">가이드 콘텐츠 검증 실패</p>
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words opacity-80">
          {errors.map((e) => `${e.code}: ${e.message}${e.path ? ` (${e.path})` : ''}`).join('\n')}
        </pre>
      </div>
    </div>
  );
}
```

> **계약**: `variant='admin'` 은 W3-c 미리보기 패널에서 명시적으로 지정된다. `GuideCardPure` 내부에서 invalid 일 때는 기본 `invalidVariant='enduser'` 로 fallback 하여 일반 사용자에게는 detail 을 노출하지 않는다.

## Step 6: 기존 GuideCard.tsx — backward compatible facade

### `app/components/features/process-status/GuideCard.tsx` (덮어쓰기 ~70 LOC)

기존 import path (`@/app/components/features/process-status/GuideCard`) 유지하기 위해 facade 로 변환:

```tsx
'use client';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveProcessStepSlotKey } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import type { ProcessStatus, AwsInstallationMode, CloudProvider } from '@/lib/types';

interface LegacyProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;                  // 'AWS' | 'Azure' | 'GCP'
  installationMode?: AwsInstallationMode;
}

/**
 * Backward compatible — 3 provider 페이지(AwsProjectPage/AzureProjectPage/GcpProjectPage)가
 * W4-b 에서 직접 GuideCardContainer 로 교체될 때까지 이 facade 가 유지된다.
 * 이번 wave(W4-a) 에서는 삭제하지 않는다.
 */
export function GuideCard(props: LegacyProps) {
  const slotKey = resolveProcessStepSlotKey(props.provider, props.currentStep, props.installationMode);
  if (!slotKey) return null;  // unreachable given exhaustive CloudProvider type
  return <GuideCardContainer slotKey={slotKey} />;
}

// W4-b 가 끝나면 이 facade 를 제거하고 3 페이지가 직접 GuideCardContainer 호출.
```

### `app/components/features/process-status/GuideCard/resolve-step-slot.ts` (~50 LOC)

**중요 — `CloudProvider` 타입 caesing**:
- `lib/types.ts` 의 `CloudProvider = 'AWS' | 'Azure' | 'GCP'` (Azure 는 title-case)
- `GuideSlot.placement.kind === 'process-step'` 의 `placement.provider` 는 slot registry 내부 표현으로 **대문자** `'AWS' | 'AZURE' | 'GCP'` 을 사용할 수 있다 (W1-a 스펙 참조).
- resolver 는 slot key 문자열을 만들 때 `toLowerCase()` 로 정규화한다.

```ts
import type { GuideSlotKey } from '@/lib/types/guide';
import type { ProcessStatus, AwsInstallationMode, CloudProvider } from '@/lib/types';

export function resolveProcessStepSlotKey(
  provider: CloudProvider,              // 'AWS' | 'Azure' | 'GCP'
  step: ProcessStatus,
  installationMode?: AwsInstallationMode,
): GuideSlotKey | null {
  if (provider === 'AWS') {
    const variant = installationMode === 'MANUAL' ? 'manual' : 'auto';
    return `process.aws.${variant}.${step}` as GuideSlotKey;
  }
  if (provider === 'Azure') return `process.azure.${step}` as GuideSlotKey;
  if (provider === 'GCP')   return `process.gcp.${step}` as GuideSlotKey;
  return null;  // unreachable given exhaustive CloudProvider type
}
```

> `'AZURE'` (대문자) 비교는 **사용하지 않는다**. `CloudProvider` 유니온에 `'Azure'` (title-case) 만 있기 때문에 `provider === 'AZURE'` 는 타입 에러가 발생한다. slot registry 내부에서 placement.provider 를 대문자로 들고 있더라도, resolver 의 비교는 CloudProvider casing 에 맞춘다.

## Step 6.5: Stable export contract

다른 wave 가 의존하는 **안정 import path**:

| Path | 소비자 | Stable since |
|------|--------|-------------|
| `@/app/components/features/process-status/GuideCard/GuideCardPure` | W3-c 미리보기 패널 | W4-a |
| `@/app/components/features/process-status/GuideCard/GuideCardInvalidState` | W3-c 미리보기 (admin variant), GuideCardPure fallback | W4-a |
| `@/app/components/features/process-status/GuideCard/GuideCardContainer` | W4-b 3 provider 페이지 migration | W4-a |
| `@/app/components/features/process-status/GuideCard` (legacy facade) | W4-b 까지 기존 3 provider 페이지가 계속 사용 | 기존 유지 |

규칙:
- **W4-a 는 legacy facade `GuideCard.tsx` 를 삭제하지 않는다**. 삭제는 W4-b 가 마지막 use site 를 교체한 뒤에.
- W3-c 는 facade 가 아닌 `GuideCardPure` 직접 import 한다 (그래야 admin preview 가 invalid 시 `variant="admin"` 으로 `GuideCardInvalidState` 를 직접 렌더할 수 있음).
- `index.ts` 는 re-export 편의용이지만 새 소비자는 각 파일을 직접 import 해 dependency 를 명확히 한다.

```ts
// app/components/features/process-status/GuideCard/index.ts
export { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
export { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
export { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
export { GuideCardError } from '@/app/components/features/process-status/GuideCard/GuideCardError';
export { GuideCardSkeleton } from '@/app/components/features/process-status/GuideCard/GuideCardSkeleton';
export { GuideCardEmptyLang } from '@/app/components/features/process-status/GuideCard/GuideCardEmptyLang';
```

## Step 7: 기존 use site 영향 확인

3 provider 페이지가 그대로 빌드되는지:

```bash
npx tsc --noEmit
grep -rn "GuideCard" 'app/integration/target-sources/[targetSourceId]/_components/' | grep -v "// "
```

prop signature `{ currentStep, provider, installationMode }` 가 facade 로 보존되어야 함. 시각도 동일.

**IDC/SDU 는 GuideCard 사용처가 없음** — grep 결과에 포함되지 않아야 정상.

## Step 8: 검증

```bash
npx tsc --noEmit
npm run lint -- app/components/features/process-status/
npm run test:run -- guide-card render-guide-ast resolve-step-slot
npm run build
bash scripts/dev.sh
# 브라우저:
# - /integration/target-sources/<id> AWS — GuideCard 시각 동일
# - /integration/target-sources/<id> Azure — GuideCard 시각 동일
# - /integration/target-sources/<id> GCP — GuideCard 시각 동일
# - 로딩 중 GuideCardSkeleton, 실패 시 GuideCardError, 해당 lang 비어있을 때 GuideCardEmptyLang
# - 깜빡임 없음 (skeleton 즉시 표시 → content 렌더)
# - IDC/SDU 페이지는 GuideCard 사용처 없음 (regression 없음 확인)
```

## Out of scope

- 3 provider 페이지가 직접 `GuideCardContainer` 호출하도록 변경 → W4-b
- 기존 `lib/constants/process-guides.ts` `DEFAULT_STEP_GUIDES` 제거 → W4-b 와 함께
- IDC / SDU 페이지 — `CloudProvider` 유니온 밖이라 GuideCard 스코프 자체에 없음
- Admin 미리보기에서 GuideCardPure 사용 → W3-c (W4-a 의 stable export 를 소비)

## PR body checklist

- [ ] `GuideCardPure` (content prop) + `GuideCardContainer` (slotKey prop) 신규
- [ ] `GuideCardInvalidState` (admin / enduser variant), `GuideCardError`, `GuideCardSkeleton`, `GuideCardEmptyLang` 신규
- [ ] `GuideCard.tsx` facade — 3 use site backward compat, W4-a 에서 삭제 **안** 함
- [ ] `resolve-step-slot.ts` — `CloudProvider` title-case (`'Azure'`) 기준, `'AZURE'` 대문자 비교 없음
- [ ] `dangerouslySetInnerHTML` 사용 안 함 — `renderGuideAst` 만
- [ ] `@/` 절대 경로만 사용 (상대 경로 금지)
- [ ] `lib/theme.ts` 토큰만 사용 (raw `bg-*` / `text-*` 색상 클래스 금지)
- [ ] 3 provider 페이지 (AWS/Azure/GCP) 시각 동일 (dev smoke 확인)
- [ ] IDC/SDU regression 없음 — grep `GuideCard` 결과에 포함되지 않음
- [ ] `@tailwindcss/typography` 미설치 환경 대응 — `prose-guide` 가 plugin 없이도 동작
- [ ] tsc 0, lint 0, build 0

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md` @ <SHA>
- Wave: W4-a
- 의존: W1-b (validator + AST renderer), W1-c (useGuide)

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — guide-card / render-guide-ast / resolve-step-slot 통과
- [ ] npm run build — exit 0
- [ ] Dev smoke — 3 provider 페이지 (AWS/Azure/GCP) 시각 동일, skeleton/error/empty-lang 상태 노출, IDC/SDU regression 없음

## Deviations from spec
<없으면 "None">

## Deferred to later waves
- W4-b: 3 provider 페이지 `GuideCard` → `GuideCardContainer` 교체 + facade 제거
- W4-b: `DEFAULT_STEP_GUIDES` 제거
```
