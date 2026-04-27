# Guide CMS — 컴포넌트 구조 메모

`/integration/admin/guides` 페이지를 구성하는 컴포넌트 분해 문서.

> **파일 범위**: `app/integration/admin/guides/page.tsx` (신규) 및 그 아래 `components/`.
> **전제**: layout 은 `app/integration/admin/layout.tsx` 를 재사용 — AdminHeader + ServiceSidebar 는 건드리지 않음.

---

## 1. 페이지 트리

```
<AdminLayout>                 ← 재사용
  └─ <GuidesPage>             ← 신규 (app/integration/admin/guides/page.tsx)
       ├─ <ProviderTabs />
       ├─ <ThreePaneShell>
       │    ├─ <StepListPanel  />   (25%)
       │    ├─ <GuideEditorPanel />  (35%)
       │    └─ <GuidePreviewPanel /> (40%)
       ├─ <UnsavedChangesModal />   (Modal via useModal)
       └─ <Toaster />               (기존 toast infra 재사용)
```

---

## 2. 신규 컴포넌트

### `<ProviderTabs />`
- Provider 5종 탭. `role="tablist"` + 키보드 좌우 화살표.
- Props
  - `value: 'aws' | 'azure' | 'gcp' | 'idc' | 'sdu'`
  - `onChange(provider)`
- 내부 로직
  - `aws | azure | gcp` 는 `onChange` 호출
  - `idc | sdu` 는 `aria-disabled="true"` + 클릭 시 toast `"{name} 가이드는 Step 구조 확정 후 별도 wave 에서 지원됩니다."`
- 스타일: 선택된 탭은 `primaryColors.DEFAULT` 하단 border + 텍스트 색.

### `<StepListPanel />`
- 좌측 25%. 현재 provider 의 step 배열을 렌더.
- Props
  - `provider`, `selectedKey`, `onSelect(key)`, `dirty: boolean`
- 행 구조: `step-no ◯` + `label` + (AWS step 4 한정) `[AUTO] / [MANUAL]` variant chip.
- 행 상호작용
  - 클릭 / Enter / Space → `onSelect`
  - `dirty === true` 상태에서 다른 행 클릭 시 `UnsavedChangesModal` 먼저 노출 (취소 시 네비게이션 중단).
- shared 표시: 같은 `guideName` 을 공유하는 step 은 `"2곳 공유"` 서브 라벨 노출.
- `stepCount` 는 provider 별 다름 (AWS 8, 나머지 7).

### `<GuideEditorPanel />`
- 중앙 35%. 섹션 4개.

| 영역 | 내용 |
|---|---|
| ① `<EditorHeader />` | provider · variant · step · title + `<ConstantBadge>` (guide name 자물쇠) |
| ② `<ScopeNotice />` | `guideMap[key].length >= 2` 일 때만. 공유 위치 나열 + "저장 시 모든 곳에 반영됩니다." |
| ③ `<LanguageTabs />` + `<TiptapEditor />` | 언어 2탭 (ko / en). 각 언어 `filled / empty` bullet 표시. 현재 탭의 content 만 편집. |
| ④ `<SaveActionRow />` | 힌트 텍스트 + `<SaveButton />` |

- 상태 단위: `{ ko: string, en: string, dirty: boolean, saving: boolean, saveError?: Error }`
- `dirty` 는 `initialContent` vs `currentContent` 비교.
- 저장 성공 → `dirty=false`, toast `"저장되었습니다"`.

### `<TiptapEditor />`
- 기반: `@tiptap/react` + `StarterKit` — 단, 허용된 확장만 활성:
  - `Heading({ levels: [4] })`
  - `Bold`, `Italic`, `Code` (inline), `BulletList`, `OrderedList`
  - `Link({ openOnClick: false })`
- 서식 외 붙여넣기 값은 `allowedTags` HTML sanitizer 로 정규화.
- 툴바 버튼 7개 순서: **H4 · B · I · `</>` · • 목록 · 1. 목록 · 🔗**
- URL prompt: 커스텀 `<LinkPromptModal>` (또는 `useModal` 경량 prompt). browser `prompt()` 금지.
- Props
  - `value`, `onChange(html)`, `lang` (ko/en — 플레이스홀더 문구 전환), `disabled`

### `<GuidePreviewPanel />`
- 우측 40%. 섹션 3개.

1. `<PreviewLanguageToggle />` — ko / en. **편집 탭과 독립**.
2. `<ProcessTimelineCompact />` — 1 line, 7 dots. 현재 step `◉` 강조. 이미 존재하는 `<ProcessTimeline>` 의 컴팩트 variant.
3. `<GuideCardPreview />` — **실제 `GuideCard.tsx` 재사용** (visual 동일).
   - invalid HTML 감지 시 `<GuideCardInvalidState />` 로 스왑.

- `aria-live="polite"` 는 panel root 에 설정 (편집 시 스크린리더 알림).

### `<UnsavedChangesModal />`
- `useModal()` 훅 기반. **browser `confirm()` 사용 금지**.
- Props: `open`, `onConfirm` (폐기 후 이동), `onCancel`
- 버튼
  - `[ 취소 ]` — `variant="outline"` · `autoFocus`
  - `[ 변경 폐기 후 이동 ]` — `variant="destructive"` (gray-700 / 회색 톤. primary 사용 금지)

### `<ErrorState />` (재사용 or 신규)
- GET 실패 시 편집 패널 자리에 표시. `title` + `message` + `onRetry` action.

### `<GuideCardInvalidState />`
- 렌더 검증 실패 시 미리보기 자리에. 관리자에게는 검증 에러 목록을 mono 폰트로 노출.

---

## 3. 재사용 컴포넌트 매핑

| 기존 컴포넌트 | 사용 위치 |
|---|---|
| `AdminHeader` | AdminLayout (변경 없음) |
| `ServiceSidebar` | AdminLayout (변경 없음) |
| `@/app/components/ui/Button` — `primary` | `SaveButton` (enabled/loading) |
| `@/app/components/ui/Button` — `outline` | 취소 / 다시 시도 |
| `@/app/components/ui/Button` — `ghost` | 없음 (가이드 CMS 에서는 사용 안함) |
| `@/app/components/ui/Modal` + `useModal()` | `UnsavedChangesModal` |
| `@/app/components/ui/Tabs` (있을 경우) | `ProviderTabs`, `LanguageTabs`, `PreviewLanguageToggle` |
| `@/app/components/ui/Toast` | PUT 실패 / provider 비활성 탭 클릭 |
| `@/app/components/features/process-status/GuideCard` | `GuidePreviewPanel` 내부 — **컴포넌트 그대로 재사용** |
| `@/app/components/features/process-status/ProcessTimeline` | 컴팩트 variant 로 확장 (prop `compact`) |
| `lib/theme.ts` — `primaryColors`, `statusColors`, `cardStyles` | 전 컴포넌트 스타일 |

> ⚠️ raw Tailwind 색상 (`bg-blue-600` 등) 직접 사용 금지. `cn(primaryColors.bg)` 처럼 theme 토큰으로.

---

## 4. Tiptap 툴바 구조

```
┌────────────────────────────────────────────┐
│  H4 │ B  I  </> │ •목록  1.목록 │ 🔗        │
└────────────────────────────────────────────┘
```

| Button | Tiptap command | 단축키 | active 판정 |
|---|---|---|---|
| H4 | `toggleHeading({ level: 4 })` | ⌘⇧4 | `editor.isActive('heading', { level: 4 })` |
| B | `toggleBold` | ⌘B | `isActive('bold')` |
| I | `toggleItalic` | ⌘I | `isActive('italic')` |
| `</>` | `toggleCode` | ⌘E | `isActive('code')` |
| •목록 | `toggleBulletList` | ⌘⇧8 | `isActive('bulletList')` |
| 1.목록 | `toggleOrderedList` | ⌘⇧7 | `isActive('orderedList')` |
| 🔗 | `LinkPromptModal` → `setLink({ href })` | ⌘K | `isActive('link')` |

- active 버튼은 `color: primary` + 흰 배경 + soft shadow.
- 링크 버튼은 URL 없을 시 prompt 띄우고, 선택 범위 없을 때는 `disabled`.
- 툴바 자체는 `role="toolbar"` + Tab 으로 버튼 이동 시 `tabindex="0" / "-1"` roving pattern.

---

## 5. 상태 머신 요약

```
                 ┌─────────────┐
   enter page ── │  LOADING    │── GET ok ──► IDLE
                 └─────────────┘
                        │
                     GET fail
                        ▼
                    ERROR_GET ── onRetry ──► LOADING

IDLE ── edit ──► DIRTY ── save ──► SAVING ──► IDLE (success toast)
                                  │
                                  └── fail ──► DIRTY + ERROR_PUT toast (입력 유지)

DIRTY ── navigate(step/provider) ──► CONFIRM_MODAL
                                        │   │
                                   cancel└─► DIRTY (그대로)
                                   confirm──► LOADING (새 step)
```
