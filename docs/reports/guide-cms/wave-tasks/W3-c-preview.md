# W3-c — Preview Panel: Timeline + GuideCard + ko/en Toggle

> **Recommended model**: **Opus 4.7 MAX** (의존성 계약 정합성 + 250ms debounce + GuideCardPure 통합 — 디자인 결정 깊이는 medium)
> **Estimated LOC**: ~400
> **Branch prefix**: `feat/guide-cms-w3c-preview`
> **Depends on**: W4-a (GuideCardPure + GuideCardInvalidState 노출, merged), W3-b (editor, merged)

## Context

미리보기 패널 본체. 편집 패널과 **독립** 인 ko/en 토글 + 7-step 컴팩트 타임라인 + W4-a 에서 노출한 `GuideCardPure` 직접 재사용 + 250ms debounce.

**W4-a 계약**: W4-a 는 `GuideCardPure` (content prop) 와 `GuideCardInvalidState` (errors + variant prop) 를 각각 stable export path 로 공개한다. W3-c 는 legacy facade (`GuideCard.tsx`) 를 사용하지 않고 이 두 컴포넌트를 직접 import 한다.

Spec: `design/guide-cms/components.md` §2 GuidePreviewPanel + `interactions.md` §3 (250ms debounce)

## Precondition

```bash
[ -d app/integration/admin/guides/components ] || { echo "✗ W3-a 미머지"; exit 1; }
[ -f app/integration/admin/guides/components/GuideEditorPanel.tsx ] || { echo "✗ W3-b 미머지"; exit 1; }
[ -f app/components/features/process-status/GuideCard/GuideCardPure.tsx ] || { echo "✗ W4-a 미머지 (GuideCardPure 부재)"; exit 1; }
[ -f app/components/features/process-status/GuideCard/GuideCardInvalidState.tsx ] || { echo "✗ W4-a 미머지 (GuideCardInvalidState 부재)"; exit 1; }
```

## Required reading

1. `design/guide-cms/components.md` §2 GuidePreviewPanel + ProcessTimelineCompact + GuideCardPreview
2. `design/guide-cms/interactions.md` §1 미리보기 키보드, §3 (debounce 250ms), §4.7 (ko 빈 상태 안내)
3. `design/guide-cms/guide-cms.html` line ~700-1000 (preview 시각)
4. `app/components/features/process-status/GuideCard/GuideCardPure.tsx` (W4-a — content prop, AST renderer)
5. `app/components/features/process-status/GuideCard/GuideCardInvalidState.tsx` (W4-a — admin variant)
6. `app/components/features/process-status/ProcessTimeline.tsx` (compact variant 추가 대상)
7. `lib/utils/validate-guide-html.ts` (렌더 검증)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w3c-preview --prefix feat
```

## Step 2: ProcessTimelineCompact

기존 `ProcessTimeline` 에 `compact` prop 추가 (또는 별도 컴포넌트).

### `app/components/features/process-status/ProcessTimeline.tsx` (수정 ~+50 LOC)

```tsx
interface Props {
  currentStep: number;
  totalSteps: number;
  compact?: boolean;  // 신규
}

// compact === true: 1 line, 7 dots (○ ─ ○ ─ ◉ ─ ○ ─ ○ ─ ○ ─ ○), 작은 numbers
// compact === false: 기존 verbose layout
```

또는 별도 파일:
### `app/components/features/process-status/ProcessTimelineCompact.tsx` (~80 LOC)

선택. 상황에 따라 더 깔끔한 쪽 선택.

## Step 3: PreviewLanguageToggle

### `app/integration/admin/guides/components/PreviewLanguageToggle.tsx` (~50 LOC)

ko/en 2 탭. **편집 탭과 독립** state.

```tsx
export function PreviewLanguageToggle({ value, onChange }) {
  // role="tablist", ←→ 화살표
  // 편집 탭의 koFilled / enFilled 와 무관 — 미리보기는 항상 ko / en 둘 다 토글 가능
  // ko 가 비어있으면 GuideCard 자리에 "한국어 본문이 아직 작성되지 않았습니다" (interactions.md §4.7)
}
```

## Step 4: GuidePreviewPanel

### `app/integration/admin/guides/components/GuidePreviewPanel.tsx` (~200 LOC)

```tsx
import { useState } from 'react';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { GuideCardInvalidState } from '@/app/components/features/process-status/GuideCard/GuideCardInvalidState';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import { resolveSlot } from '@/lib/constants/guide-registry';
import type { GuideSlotKey } from '@/lib/types/guide';
import { useDebounce } from '@/app/hooks/useDebounce';

interface Props {
  slotKey: GuideSlotKey | null;
  draftKo: string;   // 편집 패널이 prop 으로 전달
  draftEn: string;
}

export function GuidePreviewPanel({ slotKey, draftKo, draftEn }: Props) {
  const [previewLang, setPreviewLang] = useState<'ko' | 'en'>('ko');
  const slot = slotKey ? resolveSlot(slotKey) : null;

  // Debounce 250ms (interactions.md §3)
  const debouncedKo = useDebounce(draftKo, 250);
  const debouncedEn = useDebounce(draftEn, 250);
  const previewHtml = previewLang === 'ko' ? debouncedKo : debouncedEn;

  if (!slot) return <PreviewPlaceholder />;

  // Admin preview — validate 먼저, 실패 시 errors 를 mono 폰트로 노출
  const validation = previewHtml.trim() === '' ? null : validateGuideHtml(previewHtml);

  return (
    <section aria-live="polite" className="overflow-y-auto p-6">
      <PreviewLanguageToggle value={previewLang} onChange={setPreviewLang} />
      {slot.placement.kind === 'process-step' && (
        <ProcessTimelineCompact currentStep={slot.placement.step} totalSteps={7} />
      )}
      {previewHtml.trim() === '' ? (
        <PreviewEmptyLang lang={previewLang} />
      ) : validation && !validation.valid ? (
        <GuideCardInvalidState errors={validation.errors} variant="admin" />
      ) : (
        <GuideCardPure content={previewHtml} />
      )}
    </section>
  );
}
```

**계약 주의**: `GuideCardPure` 는 내부에서도 `validateGuideHtml` 을 실행하지만 기본 `invalidVariant='enduser'` 라서 generic fallback 만 노출한다. 관리자 미리보기는 에디터가 무엇을 잘못 썼는지 보여야 하므로 **여기서 먼저 validate 하고 `GuideCardInvalidState variant="admin"`** 을 직접 렌더한다. (GuideCardPure 에 `invalidVariant="admin"` 만 넘기는 것도 가능하지만, admin 미리보기에서는 empty 분기와 같은 레벨에서 처리하는 것이 더 명시적이다.)

### `app/integration/admin/guides/components/PreviewEmptyLang.tsx` (~30 LOC)

components.md §2 + interactions.md §4.7 — "한국어 / 영어 본문이 아직 작성되지 않았습니다" placeholder.

## Step 5: useDebounce 훅

### `app/hooks/useDebounce.ts` (~30 LOC)

기존 패턴 확인 — 없으면 신규:

```ts
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```

## Step 6: GuidesPage 통합

`app/integration/admin/guides/page.tsx` — placeholder 자리에 `<GuidePreviewPanel slotKey={...} draftKo={...} draftEn={...} />` 연결. 편집 패널이 draftKo/En 을 props 로 위로 lift 시킴.

## Step 7: 검증

```bash
npx tsc --noEmit
npm run lint
npm run build
bash scripts/dev.sh
# 브라우저:
# - 편집 패널 ko 텍스트 입력 → 250ms 후 미리보기 갱신
# - 미리보기 ko/en 토글 — 편집 탭과 독립
# - en 비어있는 상태에서 미리보기 en 선택 → "영어 본문이 아직 작성되지 않았습니다"
# - validateGuideHtml 실패 HTML 입력 (예: 허용 안된 태그 <script>) → GuideCardInvalidState admin variant (mono 폰트 errors)
# - GuideCardPure 시각이 실제 페이지 (예: /integration/target-sources/<id> AWS) 와 동일
# - timeline 의 step 마커가 정확
# - prefers-reduced-motion 시 transition duration 0.01ms (interactions.md §3)
```

## Out of scope

- ErrorState (GET 실패 네트워크 오류) → W3-b editor 영역 담당 (dirty nav 모달 옆)
- Confirm modal → W3-b (dirty nav)
- GuideCard 의 3 provider 페이지 (AWS/Azure/GCP) 호출부 교체 → W4-b

## PR body checklist

- [ ] 250ms debounce 검증 (타이핑 burst 동안 렌더 적게)
- [ ] ko/en 토글 편집과 독립 (편집 탭 영향 X)
- [ ] 빈 콘텐츠 placeholder 노출
- [ ] timeline compact (1 line + 7 dots)
- [ ] aria-live="polite" 적용
- [ ] prefers-reduced-motion 대응
- [ ] GuideCardPure 시각이 실제 페이지와 동일
- [ ] validateGuideHtml 실패 시 GuideCardInvalidState admin variant 노출
- [ ] `@/` 절대 경로만 사용 (상대 경로 금지)
- [ ] `lib/theme.ts` 토큰만 사용 (raw color class 금지)
- [ ] tsc 0, lint 0, build 0

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W3-c-preview.md` @ <SHA>
- Wave: W3-c
- 의존: W4-a (GuideCardPure + GuideCardInvalidState), W3-b (editor)

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] npm run build — exit 0
- [ ] Dev smoke — 편집→미리보기 250ms 반영, ko/en 독립 토글, validation fail 시 admin variant 노출, 실제 provider 페이지 시각 동일

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```
