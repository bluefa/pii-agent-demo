# W3-c — Preview Panel: Timeline + GuideCard + ko/en Toggle

> **Recommended model**: **Opus 4.7 MAX** (실시간 debounce + AST renderer 통합 + ProcessTimeline compact variant + GuideCard 재사용)
> **Estimated LOC**: ~400
> **Branch prefix**: `feat/guide-cms-w3c-preview`
> **Depends on**: W4-a (GuideCard 분리, merged), W3-b (editor, merged)

## Context

미리보기 패널 본체. 편집 패널과 **독립** 인 ko/en 토글 + 7-step 컴팩트 타임라인 + 실제 `GuideCard` (pure) 컴포넌트 재사용 + 250ms debounce.

Spec: `design/guide-cms/components.md` §2 GuidePreviewPanel + `interactions.md` §3 (250ms debounce)

## Precondition

```bash
[ -d app/integration/admin/guides/components ] || { echo "✗ W3-a 미머지"; exit 1; }
[ -f app/integration/admin/guides/components/GuideEditorPanel.tsx ] || { echo "✗ W3-b 미머지"; exit 1; }
grep -q "GuideCardContainer" app/components/features/process-status/GuideCard.tsx || { echo "✗ W4-a 미머지 (GuideCard split)"; exit 1; }
```

## Required reading

1. `design/guide-cms/components.md` §2 GuidePreviewPanel + ProcessTimelineCompact + GuideCardPreview
2. `design/guide-cms/interactions.md` §1 미리보기 키보드, §3 (debounce 250ms), §4.7 (ko 빈 상태 안내)
3. `design/guide-cms/guide-cms.html` line ~700-1000 (preview 시각)
4. `app/components/features/process-status/GuideCard.tsx` (W4-a 후 — pure variant)
5. `app/components/features/process-status/ProcessTimeline.tsx` (compact variant 추가 대상)
6. `lib/utils/validate-guide-html.ts` (렌더 검증)

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
  
  return (
    <section aria-live="polite" className="overflow-y-auto p-6">
      <PreviewLanguageToggle value={previewLang} onChange={setPreviewLang} />
      {slot.placement.kind === 'process-step' && (
        <ProcessTimelineCompact currentStep={slot.placement.step} totalSteps={7} />
      )}
      {previewHtml.trim() === '' ? (
        <PreviewEmptyLang lang={previewLang} />
      ) : (
        <GuideCard content={previewHtml} />  // W4-a 의 pure 시그니처
      )}
    </section>
  );
}
```

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
bash scripts/dev.sh
# 브라우저:
# - 편집 패널 ko 텍스트 입력 → 250ms 후 미리보기 갱신
# - 미리보기 ko/en 토글 — 편집 탭과 독립
# - en 비어있는 상태에서 미리보기 en 선택 → "영어 본문이 아직 작성되지 않았습니다"
# - GuideCard 시각이 실제 페이지 (예: /integration/projects/<id>/aws) 와 동일
# - timeline 의 step 마커가 정확
# - prefers-reduced-motion 시 transition duration 0.01ms (interactions.md §3)
```

## Out of scope

- ErrorState (GET 실패) → W3-d
- GuideCardInvalidState (validateGuideHtml fail) → W4-a 통합 결과 사용
- Confirm modal → W3-d

## PR body checklist

- [ ] 250ms debounce 검증 (타이핑 burst 동안 렌더 적게)
- [ ] ko/en 토글 편집과 독립 (편집 탭 영향 X)
- [ ] 빈 콘텐츠 placeholder 노출
- [ ] timeline compact (1 line + 7 dots)
- [ ] aria-live="polite" 적용
- [ ] prefers-reduced-motion 대응
- [ ] GuideCard 시각이 실제 페이지와 동일
- [ ] tsc 0, lint 0
