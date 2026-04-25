# W3-b — Editor Panel: Tiptap + Language Tabs + Save Flow

> **Recommended model**: **Opus 4.7 MAX** (Tiptap 통합 · 7-button toolbar · roving tabindex · ko/en 상태머신 · 저장 게이트)
> **Estimated LOC**: ~800
> **Branch prefix**: `feat/guide-cms-w3b-editor`
> **Depends on**: W1-b, W1-c, W3-a (all merged)

## Context

편집 패널 본체. Tiptap 기반 HTML 에디터 + ko/en 언어 탭 (독립 입력 유지) + 영향 범위 안내 + 저장 버튼 상태머신 + dirty 상태.

Spec: `design/guide-cms/components.md` §2 GuideEditorPanel / TiptapEditor + §4 Tiptap toolbar + §5 상태머신 + `interactions.md` §1, §3, §4

## Precondition

```bash
[ -f lib/utils/validate-guide-html.ts ] || { echo "✗ W1-b 미머지"; exit 1; }
[ -f app/hooks/useGuide.ts ] || { echo "✗ W1-c 미머지"; exit 1; }
[ -d app/integration/admin/guides ] || { echo "✗ W3-a 미머지"; exit 1; }
node -e "const p=require('./package.json'); ['@tiptap/core','@tiptap/react','@tiptap/starter-kit','@tiptap/extension-link'].forEach(d=>{ if(!p.dependencies[d]) { console.error('✗ '+d+' 미설치 — W0 PR 먼저'); process.exit(1) } })"
```

## Required reading

1. `design/guide-cms/components.md` §2 GuideEditorPanel, TiptapEditor, LanguageTabs, ScopeNotice, SaveActionRow + §4 Tiptap toolbar 구조 + §5 상태머신
2. `design/guide-cms/interactions.md` §1 (편집 패널 키보드), §3 (트랜지션), §4.3 (⌘S), §4.4 (링크 prompt)
3. `design/guide-cms/guide-cms.html` line ~300-700 (편집 패널 시각)
4. `lib/utils/validate-guide-html.ts` (편집 후 validation)
5. `app/hooks/useGuide.ts` (data flow)
6. `lib/constants/guide-registry.ts` `findSlotsForGuide()` (영향 범위)
7. Existing `useModal` hook (LinkPromptModal 용)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w3b-editor --prefix feat
```

## Step 2: Tiptap 에디터 컴포넌트 (lazy load)

### `app/integration/admin/guides/components/TiptapEditor/index.tsx` (~100 LOC, dynamic import 진입점)

Admin 외 페이지에 Tiptap 번들 누설 방지:

```tsx
'use client';
import dynamic from 'next/dynamic';

export const TiptapEditor = dynamic(
  () => import('./TiptapEditorImpl').then(m => ({ default: m.TiptapEditorImpl })),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded" /> },
);
```

### `app/integration/admin/guides/components/TiptapEditor/TiptapEditorImpl.tsx` (~200 LOC)

Spec §5.4 + components.md §4:

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TiptapToolbar } from './TiptapToolbar';
import { LinkPromptModal } from './LinkPromptModal';

export function TiptapEditorImpl({ value, onChange, lang, disabled }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [4] },
        strike: false, codeBlock: false, blockquote: false, horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        validate: (href) => /^(https?:\/\/|mailto:|\/(?!\/))/.test(href),
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // ⌘K 캐치 → linkOpen
  // ⌘S 캐치 → 외부 onSave (prop) — 이번 컴포넌트는 emit 만
  
  return (
    <div role="region" aria-label={`${lang} 가이드 편집기`}>
      <TiptapToolbar editor={editor} onLinkClick={() => setLinkOpen(true)} />
      <EditorContent editor={editor} className="prose-guide min-h-[200px]" />
      <LinkPromptModal open={linkOpen} onClose={() => setLinkOpen(false)} editor={editor} />
    </div>
  );
}
```

### `app/integration/admin/guides/components/TiptapEditor/TiptapToolbar.tsx` (~150 LOC)

components.md §4 표 그대로 7개 버튼:

| Button | label / aria-label | command | shortcut |
|---|---|---|---|
| H4 | 제목 4 | `toggleHeading({ level: 4 })` | ⌘⇧4 |
| B | 굵게 | `toggleBold` | ⌘B |
| I | 기울임 | `toggleItalic` | ⌘I |
| `</>` | 인라인 코드 | `toggleCode` | ⌘E |
| • 목록 | 글머리 기호 목록 | `toggleBulletList` | ⌘⇧8 |
| 1. 목록 | 번호 매김 목록 | `toggleOrderedList` | ⌘⇧7 |
| 🔗 | 링크 | `setLink` (prompt) | ⌘K |

`role="toolbar"` + roving tabindex (Tab 1 번 진입, 내부 `←→` 이동):

```tsx
const buttons = ['h4', 'bold', 'italic', 'code', 'bulletList', 'orderedList', 'link'];
const [focusIdx, setFocusIdx] = useState(0);
// Tab 으로 진입 시 focusIdx 위치 버튼 focus
// ←→ 로 focusIdx 이동
// 각 버튼은 active state 시 primary text + 흰 배경 + soft shadow
```

### `app/integration/admin/guides/components/TiptapEditor/LinkPromptModal.tsx` (~80 LOC)

`useModal()` 기반 — browser `prompt()` 사용 금지.

```tsx
export function LinkPromptModal({ open, onClose, editor }) {
  // Modal 안에 input + 확인/취소 버튼
  // Enter → setLink({ href }), Esc → 취소
  // 빈 문자열 → unsetLink
  // editor 가 selection 없으면 disabled
}
```

## Step 3: GuideEditorPanel + Language Tabs

### `app/integration/admin/guides/components/GuideEditorPanel.tsx` (~200 LOC)

components.md §2 GuideEditorPanel — 4개 영역:

```tsx
interface Props {
  slotKey: GuideSlotKey;  // 부모에서 받음 — null 일 때는 placeholder
}

export function GuideEditorPanel({ slotKey }: Props) {
  const slot = useMemo(() => resolveSlot(slotKey), [slotKey]);
  const { data, loading, error, save } = useGuide(slot.guideName);
  
  const [draftKo, setDraftKo] = useState(data?.contents.ko ?? '');
  const [draftEn, setDraftEn] = useState(data?.contents.en ?? '');
  const [activeLang, setActiveLang] = useState<'ko' | 'en'>('ko');
  const [saving, setSaving] = useState(false);
  
  // initial load → draft 동기화
  useEffect(() => {
    if (data) { setDraftKo(data.contents.ko); setDraftEn(data.contents.en); }
  }, [data]);
  
  const dirty = data ? (draftKo !== data.contents.ko || draftEn !== data.contents.en) : false;
  const koValid = draftKo.trim().length > 0 && validateGuideHtml(draftKo).valid;
  const enValid = draftEn.trim().length > 0 && validateGuideHtml(draftEn).valid;
  const canSave = koValid && enValid && dirty && !saving;
  
  // dirty 를 부모(GuidesPage) 로 전파 — confirm modal 트리거 (W3-d 에서 사용)
  // useEffect: onDirtyChange?.(dirty)
  
  // 저장 핸들러 — save() 호출 후 toast
  // 실패 시 error toast + state 유지
  
  return (
    <section>
      <EditorHeader slot={slot} />
      <ScopeNotice guideName={slot.guideName} />
      <LanguageTabs value={activeLang} onChange={setActiveLang} koFilled={draftKo.length > 0} enFilled={draftEn.length > 0} />
      <TiptapEditor
        value={activeLang === 'ko' ? draftKo : draftEn}
        onChange={activeLang === 'ko' ? setDraftKo : setDraftEn}
        lang={activeLang}
        disabled={loading || saving}
      />
      <SaveActionRow canSave={canSave} saving={saving} onSave={handleSave} koValid={koValid} enValid={enValid} />
    </section>
  );
}
```

### `app/integration/admin/guides/components/EditorHeader.tsx` (~60 LOC)

```
AWS · AUTO · 3단계 연동 대상 반영 중      [🔒 AWS_APPLYING]
```

`<ConstantBadge name={slot.guideName} />` — 자물쇠 아이콘 + monospace text.

### `app/integration/admin/guides/components/ScopeNotice.tsx` (~50 LOC)

`findSlotsForGuide(name).length >= 2` 일 때만 노출:

```
ⓘ 이 가이드는 2곳에 표시됩니다:
   · AWS · AUTO · 3단계 연동 대상 반영 중
   · AWS · MANUAL · 3단계 연동 대상 반영 중
   저장 시 모든 곳에 반영됩니다.
```

### `app/integration/admin/guides/components/LanguageTabs.tsx` (~70 LOC)

components.md §2 ③ — `role="tablist"` + 좌우 화살표 + filled/empty dot:
- `[● ko 작성됨]` `[○ en 미작성]` 형태 (dot 색은 primary / fg-4)

### `app/integration/admin/guides/components/SaveActionRow.tsx` (~80 LOC)

components.md §2 ④ + §5 상태머신:
- `canSave === true`: primary `<Button>` 활성, label = "저장"
- `canSave === false`: disabled + `aria-disabled` + tooltip "ko, en 모두 작성해야 저장할 수 있습니다"
- `saving`: 스피너 + "저장 중..."
- ⌘S 단축키 (interactions.md §4.3)

## Step 4: GuidesPage 통합

`app/integration/admin/guides/page.tsx` 수정 — placeholder 자리에 `<GuideEditorPanel slotKey={selected} />` 주입. dirty 상태를 부모로 전파 (W3-d 에서 confirm modal 연결).

## Step 5: 검증

```bash
npx tsc --noEmit
npm run lint -- app/integration/admin/guides/
bash scripts/dev.sh
# 브라우저:
# - AWS step 1 선택 → ScopeNotice 가 "2곳에 표시됩니다" 출력
# - ko 빈 상태 + en 빈 상태 → 저장 disabled
# - ko 만 작성 → 저장 disabled (en 도 필요)
# - ko + en 모두 작성 → 저장 enabled
# - 저장 클릭 → 200 → toast "저장되었습니다" → dirty=false
# - 잘못된 HTML 붙여넣기 (Tiptap 이 정리하지만, 만약 우회) → 저장 시 400
# - 툴바 7 버튼 모두 동작 (active 표시 포함)
# - ⌘K → LinkPromptModal · ⌘S → 저장
# - Tab 으로 툴바 진입 후 ←→ 이동
```

## Out of scope

- Preview panel (GuideCard 재사용) → W3-c
- UnsavedChangesModal (dirty guard) → W3-d
- Error state (GET 실패 시 ErrorState 표시) → W3-d

## PR body checklist

- [ ] Tiptap dynamic import (admin 페이지 외 번들 누설 X)
- [ ] 7 buttons toolbar — H4/B/I/Code/BulletList/OrderedList/Link 모두 active state 표시
- [ ] roving tabindex — Tab 으로 toolbar 진입 후 ←→ 이동
- [ ] ⌘B / ⌘I / ⌘E / ⌘K / ⌘⇧4 / ⌘⇧7 / ⌘⇧8 / ⌘S 단축키 동작
- [ ] LinkPromptModal — useModal 기반 (browser prompt() X)
- [ ] LanguageTabs — ko/en 독립 입력 유지 + filled/empty dot
- [ ] SaveButton — 4 상태 (idle / disabled / saving / error)
- [ ] ScopeNotice — N≥2 일 때만 노출
- [ ] tsc 0, lint 0, dev smoke OK
