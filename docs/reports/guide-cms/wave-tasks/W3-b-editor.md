# W3-b — Editor Panel: Tiptap + Language Tabs + Save Flow + Dirty Nav Guard

> **Recommended model**: **Opus 4.7 MAX** (Tiptap 통합 · 7-button toolbar · roving tabindex · ko/en 상태머신 · 저장 게이트 · dirty nav guard)
> **Estimated LOC**: ~900 (W3-d dirty nav guard 병합 반영)
> **Branch prefix**: `feat/guide-cms-w3b-editor`
> **Depends on**: W1-b, W1-c, W3-a (all merged)

## Context

편집 패널 본체. Tiptap 기반 HTML 에디터 + ko/en 언어 탭 (독립 입력 유지) + 영향 범위 안내 + 저장 버튼 상태머신 + dirty 상태 + dirty navigation guard (UnsavedChangesModal + beforeunload).

Spec: `design/guide-cms/components.md` §2 GuideEditorPanel / TiptapEditor + §4 Tiptap toolbar + §5 상태머신 + `interactions.md` §1, §3, §4 (특히 §4.1 dirty guard, §4.2 provider 전환)

> **Scope 변경**: 기존 W3-d (dirty nav guard + UnsavedChangesModal) 가 이 wave 로 병합됨. Error state 표시는 W4-a 로 이관.

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
  () => import('@/app/integration/admin/guides/components/TiptapEditor/TiptapEditorImpl').then(m => ({ default: m.TiptapEditorImpl })),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded" /> },
);
```

### `app/integration/admin/guides/components/TiptapEditor/TiptapEditorImpl.tsx` (~200 LOC)

Spec §5.4 + components.md §4:

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TiptapToolbar } from '@/app/integration/admin/guides/components/TiptapEditor/TiptapToolbar';
import { LinkPromptModal } from '@/app/integration/admin/guides/components/TiptapEditor/LinkPromptModal';

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
      <LinkPromptModal isOpen={linkOpen} onClose={() => setLinkOpen(false)} editor={editor} />
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
// 프로젝트 Modal 의 prop 이름 `isOpen` 과 일치시킨다.
export function LinkPromptModal({ isOpen, onClose, editor }) {
  // <Modal isOpen={isOpen} onClose={onClose} title="링크 삽입"> 안에 input + 확인/취소 버튼
  // Enter → setLink({ href }), Esc → 취소
  // 빈 문자열 → unsetLink
  // editor 가 selection 없으면 disabled
  // Button variants: primary (확인) / secondary (취소) — outline/destructive 없음
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

## Step 4: GuidesPage 통합 (1차 — slotKey + dirty lift)

`app/integration/admin/guides/page.tsx` 수정 — placeholder 자리에 `<GuideEditorPanel slotKey={selected} />` 주입.

`GuideEditorPanel` 의 `dirty` 상태를 부모(`GuidesPage`) 로 lift 하기 위한 prop 추가:

```tsx
// GuideEditorPanel props 확장
interface Props {
  slotKey: GuideSlotKey;
  onDirtyChange: (dirty: boolean) => void;  // Step 5 가드가 참조
}

// 내부에서 useEffect 로 전파
useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
```

`GuidesPage` 는 `dirty` state 를 보관만 하고, 실제 가드 로직은 Step 5 에서 구현.

## Step 5: Dirty Navigation Guard + UnsavedChangesModal

dirty 상태에서 다른 step 행 클릭 · provider 탭 전환 · 브라우저 탭 닫기 시 이동을 차단. 기존 W3-d 의 로직이 여기로 병합됨. Spec: `interactions.md` §4.1 / §4.2 + Confirm Modal 절.

### `app/integration/admin/guides/components/UnsavedChangesModal.tsx` (~50 LOC)

프로젝트 `Modal` 컴포넌트는 `isOpen` prop 사용 (NOT `open`), `Button` 은 `primary | secondary | danger` 3종만 지원 (NO `outline` / `destructive` / `autoFocus`):

```tsx
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({ isOpen, onConfirm, onCancel }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="저장되지 않은 변경사항">
      <p>현재 편집 중인 내용이 저장되지 않았습니다. 이동하시겠습니까?</p>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onCancel}>취소</Button>
        <Button variant="danger" onClick={onConfirm}>변경 폐기 후 이동</Button>
      </div>
    </Modal>
  );
}
```

> **Autofocus 주의**: 프로젝트 `Button` 에는 `autoFocus` prop 이 없다. interactions.md §Confirm Modal 의 "취소 버튼 autoFocus" 를 구현하려면 `ref={secondaryRef}` + `useEffect(() => secondaryRef.current?.focus(), [isOpen])` 패턴을 `UnsavedChangesModal` 내부에서 직접 처리하거나, 첫 이터레이션에서는 생략 후 후속 wave 에서 polish.

### `GuidesPage` 통합 — 네비게이션 인터셉트

`app/integration/admin/guides/page.tsx` 를 Step 4 결과에서 추가 수정:

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { ProviderTabs } from '@/app/integration/admin/guides/components/ProviderTabs';
import { StepListPanel } from '@/app/integration/admin/guides/components/StepListPanel';
import { GuideEditorPanel } from '@/app/integration/admin/guides/components/GuideEditorPanel';
import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import { UnsavedChangesModal } from '@/app/integration/admin/guides/components/UnsavedChangesModal';
import { useModal } from '@/app/hooks/useModal';
import type { GuideSlotKey } from '@/lib/types/guide';
import type { ProviderTab } from '@/app/integration/admin/guides/types';

type PendingNavigation =
  | { kind: 'select-step'; key: GuideSlotKey }
  | { kind: 'switch-provider'; provider: ProviderTab };

export default function GuidesPage() {
  const [provider, setProvider] = useState<ProviderTab>('aws');
  const [selected, setSelected] = useState<GuideSlotKey | null>(null);
  const [dirty, setDirty] = useState(false);

  const guard = useModal<PendingNavigation>();

  // dirty 가드: 다른 step 클릭
  const handleSelectStep = useCallback((key: GuideSlotKey) => {
    if (dirty) {
      guard.open({ kind: 'select-step', key });
      return;
    }
    setSelected(key);
  }, [dirty, guard]);

  // dirty 가드: provider 전환
  const handleSwitchProvider = useCallback((next: ProviderTab) => {
    if (dirty) {
      guard.open({ kind: 'switch-provider', provider: next });
      return;
    }
    setProvider(next);
    setSelected(null);
  }, [dirty, guard]);

  // 브라우저 탭 닫기 / 새로고침 가드 — interactions.md §4.2 외연
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';  // Chrome 요구사항
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleConfirmDiscard = () => {
    const pending = guard.data;
    if (!pending) { guard.close(); return; }
    if (pending.kind === 'select-step') {
      setSelected(pending.key);
    } else {
      setProvider(pending.provider);
      setSelected(null);
    }
    setDirty(false);  // 폐기
    guard.close();
  };

  return (
    <div className="flex flex-col h-full">
      <ProviderTabs value={provider} onChange={handleSwitchProvider} />
      <div className="grid grid-cols-[25%_35%_40%] flex-1 overflow-hidden">
        <StepListPanel provider={provider} selectedKey={selected} onSelect={handleSelectStep} />
        {selected
          ? <GuideEditorPanel slotKey={selected} onDirtyChange={setDirty} />
          : <GuidePlaceholder>편집할 단계를 선택해주세요</GuidePlaceholder>}
        <GuidePlaceholder>미리보기 영역</GuidePlaceholder>
      </div>
      <UnsavedChangesModal
        isOpen={guard.isOpen}
        onConfirm={handleConfirmDiscard}
        onCancel={guard.close}
      />
    </div>
  );
}
```

### Contract 포인트

- `dirty` 는 `GuideEditorPanel` 이 `onDirtyChange` 로 push (부모가 poll 하지 않음).
- `pendingNavigation` 은 `useModal<PendingNavigation>` 의 `data` 로 보관 — 모달 닫힐 때 자동 초기화 (useModal 구현).
- `setDirty(false)` 는 "폐기 후 이동" 직후 호출 — 에디터는 `slotKey` 변경 또는 reset effect 로 draft 재초기화.
- `beforeunload` 는 `dirty === true` 일 때만 등록 — 페이지 리로드 성능 영향 최소화.

### Out-of-panel 이동 (TopNav / 브레드크럼) — defer

`<Link>` / `router.push` 로의 페이지-간 이동 가드는 **이번 wave 에서 제외** (Next.js App Router 의 `beforeunload` 는 client-side nav 에는 발화하지 않음 — custom `usePathname` 감시 또는 link click 인터셉트 필요). interactions.md §4 에도 명시되지 않은 범위. 후속 wave 로 이관.

## Step 6: 검증

```bash
npx tsc --noEmit
npm run lint -- app/integration/admin/guides/
npm run build   # route 추가 없음이지만 Tiptap dynamic bundle 확인
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
# Dirty nav guard:
# - dirty 상태에서 다른 step 행 클릭 → UnsavedChangesModal 열림 · 취소 시 원래 step 유지
# - 모달 "변경 폐기 후 이동" → 새 step 로 전환 + draft 초기화
# - dirty 상태에서 AZURE 탭 클릭 → 모달 → 폐기 시 selected=null
# - dirty 상태에서 브라우저 탭 닫기 시도 → 네이티브 confirm 다이얼로그
# - dirty=false 일 때는 가드 발화하지 않음
```

## Out of scope

- Preview panel (GuideCard 재사용) → W3-c
- Error state (GET 실패 시 ErrorState 표시) → W4-a
- Out-of-panel 네비게이션 (TopNav / 브레드크럼 Link click) 가드 → 후속 wave
- `UnsavedChangesModal` 의 취소 버튼 `autoFocus` ref 처리 — 첫 이터레이션 이후 polish

## PR body checklist

- [ ] Tiptap dynamic import (admin 페이지 외 번들 누설 X)
- [ ] 7 buttons toolbar — H4/B/I/Code/BulletList/OrderedList/Link 모두 active state 표시
- [ ] roving tabindex — Tab 으로 toolbar 진입 후 ←→ 이동
- [ ] ⌘B / ⌘I / ⌘E / ⌘K / ⌘⇧4 / ⌘⇧7 / ⌘⇧8 / ⌘S 단축키 동작
- [ ] LinkPromptModal — useModal 기반 (browser prompt() X)
- [ ] LanguageTabs — ko/en 독립 입력 유지 + filled/empty dot
- [ ] SaveButton — 4 상태 (idle / disabled / saving / error)
- [ ] ScopeNotice — N≥2 일 때만 노출
- [ ] UnsavedChangesModal — dirty + step 변경 / provider 전환 시 인터셉트
- [ ] `beforeunload` — dirty 상태에서만 등록, dirty=false 면 해제
- [ ] `Modal` `isOpen` prop 사용 (NOT `open`), `Button` `secondary` / `danger` variant 만 사용
- [ ] tsc 0, lint 0, build exit 0, dev smoke OK

## PR body template

## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W3-b-editor.md` @ <SHA>
- Wave: W3-b (W3-d dirty nav guard 병합)
- 의존: W1-b, W1-c, W3-a

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] npm run build — exit 0 (UI/route 영향)
- [ ] Dev smoke — editor 7-button toolbar + ko/en 저장 · dirty 상태 step/provider 전환 인터셉트 · beforeunload 네이티브 다이얼로그

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
