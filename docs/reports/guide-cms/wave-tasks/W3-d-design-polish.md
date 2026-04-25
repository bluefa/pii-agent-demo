# W3-d — Admin Guide CMS 디자인 시안 정합성 폴리시

> **Recommended model**: Sonnet 4.6 (디자인 결정은 시안 HTML에 박혀 있음 — token 매핑 + 클래스 교체 위주)
> **Estimated LOC**: ~280–340 (대부분 클래스 변경, 신규 파일 0)
> **Branch prefix**: `feat/guide-cms-w3d-design-polish`
> **Depends on**: W3-a, W3-b, W3-c (모두 머지 완료 — `app/integration/admin/guides` 트리 존재)

## Context

W3-c (#389) 머지 후 `design/guide-cms/guide-cms.html` 시안이 업데이트되었음 (1318→1575 LOC, +257 LOC). 추가된 내용은 **embedded CSS token system** (Geist 폰트 + 4-tier radius + 3-tier border + segmented control + halo glow 등) — 이전 디자인은 `<link rel="stylesheet" href="../globals.css" />`로 외부 globals.css에 의존했으나 신규 시안은 자체 token system을 정의.

**이번 wave는 visual-only 폴리시**. 행동 (debounce 250ms / dirty guard / validation 계약 / Tiptap 확장 / mock API) 변경 없음. 사용자가 시안 HTML과 실제 페이지를 나란히 띄워봤을 때 **픽셀 단위로 일치**하는 것이 목표.

Spec 본체: `design/guide-cms/guide-cms.html` (시각 reference) + `design/guide-cms/components.md` (구조 reference). 인터랙션 변경 없으므로 `interactions.md`는 검토 only.

## Precondition

```bash
# W3-a/b/c 모두 머지된 상태인지 확인
[ -f app/integration/admin/guides/page.tsx ] || { echo "✗ W3-a 미머지"; exit 1; }
[ -f app/integration/admin/guides/components/GuideEditorPanel.tsx ] || { echo "✗ W3-b 미머지"; exit 1; }
[ -f app/integration/admin/guides/components/GuidePreviewPanel.tsx ] || { echo "✗ W3-c 미머지"; exit 1; }
[ -f app/components/features/process-status/ProcessTimelineCompact.tsx ] || { echo "✗ W3-c 미머지"; exit 1; }

# 신규 디자인 시안이 main 에 반영되었는지 (이 PR의 분리 docs 커밋이 머지된 후)
grep -q "color-primary-50" design/guide-cms/guide-cms.html || { echo "✗ 신규 시안 미반영"; exit 1; }
```

## Required reading

1. `design/guide-cms/guide-cms.html` — **이번 wave의 단일 source of truth (시각)**
   - 라인 7–264: `<style>` 블록 — 신규 token system (CSS variables)
   - 라인 378–411: `.tab` (`ProviderTabs`)
   - 라인 445–499: `.step-card` + `.step-no` + `.step-info` (`StepListPanel`)
   - 라인 502–617: `.edit-pane` 본체 + `.edit-header-card` + `.scope-notice` + `.lang-tabs` + `.editor-frame`
   - 라인 535–561: `.toolbar` + `.tb-btn` (toolbar 30×30 grid)
   - 라인 691–699, 702–735: `.preview-lang` + `.mini-timeline`
   - 라인 793–806: `.empty-pane` (`GuidePlaceholder`)
   - 라인 872–887: `.umodal` (UnsavedChangesModal radius 14)
   - 라인 962–973: `.breadcrumb` + `.page-header`
2. `design/guide-cms/components.md` — 컴포넌트 트리 + 재사용 매핑 (변경 없음)
3. `lib/theme.ts` — 현재 토큰 (Step 2 에서 확장)
4. `app/integration/admin/guides/page.tsx` (수정 대상)
5. `app/integration/admin/guides/components/*.tsx` (8 개 수정 대상)
6. `app/components/features/process-status/ProcessTimelineCompact.tsx` (수정 대상)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w3d-design-polish --prefix feat
cd /Users/study/pii-agent-demo-guide-cms-w3d-design-polish
npm install   # ⚠️ Turbopack symlink 규칙
```

## Step 2: `lib/theme.ts` 토큰 확장 (~70 LOC)

신규 시안의 CSS 변수를 Tailwind 토큰으로 미러링. **모든 추가는 명시 클래스 (raw 색상 직접 사용 금지)**.

### `primaryColors` 확장

```ts
// 기존 primaryColors 객체에 추가
bg50:        'bg-blue-50',          // --color-primary-50  (#EFF6FF)
bg100:       'bg-blue-100',         // --color-primary-100 (#DBEAFE)
border100:   'border-blue-200',     // 선택된 step-card border
borderLight: 'border-blue-100',     // scope-notice 카드 외곽
textDark:    'text-blue-900',       // scope-notice 본문
```

### `borderColors` 3-tier 확장

```ts
export const borderColors = {
  light:   'border-gray-100',  // --border-light  : 카드 내부 구분선
  default: 'border-gray-200',  // --border-default: 카드/입력 외곽 (기존)
  strong:  'border-gray-300',  // --border-strong : step-no 원형 테두리
} as const;
```

### `shadows` 추가 (신규 그룹)

```ts
export const shadows = {
  pill:   'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',    // active toolbar btn / active segmented
  card:   'shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06)]',
  modal:  'shadow-[0_20px_25px_-5px_rgb(0_0_0/0.10),0_8px_10px_-6px_rgb(0_0_0/0.10)]',
} as const;
```

### `chipStyles` 추가 (신규 그룹)

```ts
export const chipStyles = {
  base: 'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold',
  variant: {
    auto:    'bg-blue-50 text-blue-700 border border-blue-200',
    manual:  'bg-amber-50 text-amber-800 border border-amber-200',
    prep:    'bg-gray-100 text-gray-500 border border-gray-200',  // "준비 중" (IDC/SDU)
  },
} as const;
```

### `segmentedControlStyles` 추가 (신규 그룹) — 편집 lang-tabs + 미리보기 lang-toggle 공유

```ts
export const segmentedControlStyles = {
  container: 'inline-flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 gap-0.5',
  item:      'px-3 py-1.5 text-[13px] font-medium text-gray-500 rounded-md transition-colors hover:text-gray-700',
  itemActive:'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
} as const;
```

### `pageChromeStyles` 추가 (신규 그룹)

```ts
export const pageChromeStyles = {
  breadcrumb: 'text-[12.5px] text-gray-500 px-6 pt-5',
  title:      'text-[24px] font-semibold tracking-[-0.02em] text-gray-900 px-6 mt-1',
  subtitle:   'text-[13.5px] text-gray-500 px-6 mt-1 mb-5',
} as const;
```

### `cardStyles.editorFrame` 추가 (Editor 전용 wrapper)

```ts
// cardStyles 객체에 키 추가
editorFrame: 'border border-gray-200 rounded-lg bg-white overflow-hidden',
toolbarSurface: 'flex items-center gap-1 bg-gray-50 border-b border-gray-200 px-2 py-1.5',
toolbarBtn:    'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-gray-600 transition-colors hover:bg-white',
toolbarBtnActive: 'bg-white text-blue-600 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
```

### `tabularNumsClass` (Geist 폰트 feature)

```ts
// step number, timeline 점 번호 등에 사용
export const numericFeatures = {
  tabular: 'tabular-nums',  // step-no, mini-timeline label
} as const;
```

## Step 3: `page.tsx` — Page chrome 추가 (~25 LOC)

design 시안 라인 962–973 참고. ProviderTabs 위에 breadcrumb + page-header.

```tsx
// app/integration/admin/guides/page.tsx
import { pageChromeStyles } from '@/lib/theme';

return (
  <div className="flex flex-col h-[calc(100vh-64px)]">
    <nav aria-label="breadcrumb" className={pageChromeStyles.breadcrumb}>
      <span>관리자</span>
      <span className="mx-1.5 text-gray-400">›</span>
      <span>가이드 관리</span>
    </nav>
    <h1 className={pageChromeStyles.title}>프로세스 가이드 관리</h1>
    <p className={pageChromeStyles.subtitle}>설치 단계별 안내 콘텐츠를 관리합니다.</p>
    <ProviderTabs ... />
    <div className="grid grid-cols-[25%_35%_40%] flex-1 overflow-hidden">
      ...
    </div>
  </div>
);
```

## Step 4: `ProviderTabs.tsx` — 컬러 dot + "준비 중" chip (~30 LOC delta)

design 시안 라인 378–411 참고.

```tsx
// 각 탭 라벨 앞에 8×8 rounded-sm provider color dot
// IDC/SDU 는 라벨 뒤에 "준비 중" chip 노출

const PROVIDER_DOT: Record<ProviderTab, string> = {
  aws:   'bg-[#FF9900]',
  azure: 'bg-[#0078D4]',
  gcp:   'bg-[#4285F4]',
  idc:   'bg-gray-700',
  sdu:   'bg-purple-600',
};

<button
  role="tab"
  className={cn(
    'inline-flex items-center gap-2 px-5 pt-3 pb-3.5 text-[13.5px] font-medium -mb-px',
    isActive ? 'border-b-2 border-blue-600 text-gray-900' : 'border-b-2 border-transparent text-gray-500'
  )}
>
  <span className={cn('w-2 h-2 rounded-sm', PROVIDER_DOT[tab])} aria-hidden />
  {label}
  {(tab === 'idc' || tab === 'sdu') && (
    <span className={cn(chipStyles.base, chipStyles.variant.prep)}>준비 중</span>
  )}
</button>
```

> ⚠️ tab container 는 `border-b border-gray-200` 유지. 활성 탭의 `border-b-2 border-blue-600 -mb-px` 가 1px 라인을 덮어 씌우는 패턴.

## Step 5: `StepListPanel.tsx` — Row 시각 재작업 (~50 LOC delta)

design 시안 라인 445–499 참고.

| 변경 | Before | After |
|---|---|---|
| 행 구분선 | `border-b border-gray-200` | 제거 → `gap-0.5` (rows 간 2px 간격) |
| step-no | `'◉'` 문자 | 24×24 rounded-full 흰색 채움 + `border-strong` (1.5px). 선택 시 `bg-blue-600 text-white border-transparent` |
| 선택된 row | `bgLight` + `text` | `bg-blue-50` + `border border-blue-200` + 좌측 3px `bg-blue-600` bar (`relative`+`before:absolute`) |
| 공유 hint | 텍스트 `2곳 공유` | 14×14 share icon (`<Share2>` lucide) + `2곳 공유` (text-[11.5px] text-gray-500) |
| typography | `text-sm` | step-no 13px tabular-nums + label 13.5px medium |
| AWS step 4 chip | 단색 `bg-blue-100` | `chipStyles.variant.auto` / `.variant.manual` |

```tsx
// 행 구조
<button
  className={cn(
    'relative grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-3 rounded-lg',
    'transition-colors',
    isSelected
      ? 'bg-blue-50 border border-blue-200 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:bg-blue-600 before:rounded-full'
      : 'border border-transparent hover:bg-gray-50',
  )}
>
  <span className={cn(
    'inline-flex items-center justify-center w-6 h-6 rounded-full text-[12.5px] font-semibold tabular-nums',
    isSelected ? 'bg-blue-600 text-white' : 'bg-white border-[1.5px] border-gray-300 text-gray-500'
  )}>
    {step}
  </span>
  ...
</button>
```

## Step 6: `EditLanguageTabs.tsx` + `PreviewLanguageToggle.tsx` — Pill segmented control (~40 LOC delta 합계)

design 시안 라인 535–561 (편집), 691–699 (미리보기) 참고. **두 컴포넌트가 동일한 segmented 토큰을 공유**.

```tsx
// 공통 패턴 (양쪽 동일)
<div role="tablist" className={segmentedControlStyles.container}>
  {tabs.map(tab => (
    <button
      role="tab"
      aria-selected={tab === value}
      className={cn(
        segmentedControlStyles.item,
        tab === value && segmentedControlStyles.itemActive
      )}
      onClick={() => onChange(tab)}
    >
      {labelMap[tab]}
      {/* 편집 lang-tabs 만: filled/empty bullet */}
      {showFilledIndicator && (
        <span className={cn(
          'ml-1.5 inline-block w-1.5 h-1.5 rounded-full',
          isFilled[tab] ? 'bg-blue-600' : 'bg-gray-300'
        )} />
      )}
    </button>
  ))}
</div>
```

> ⚠️ 키보드 화살표 nav (`onKeyDown` ←→) 는 기존 로직 유지. 색상/레이아웃만 교체.

## Step 7: `GuideEditorPanel.tsx` — Header card + scope-notice + editor-frame (~60 LOC delta)

design 시안 라인 502–617 참고.

### 7-1. `<EditorHeader />` 분리 또는 인라인

```tsx
// edit-header-card (gray-50 박스 + 🔒 mono badge)
<div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 flex items-center justify-between">
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-2 text-[12px] text-gray-500 font-medium">
      <span>{providerLabel}</span>
      {variant && <span className={cn(chipStyles.base, chipStyles.variant[variant])}>{variant.toUpperCase()}</span>}
      <span className="text-gray-300">·</span>
      <span>Step {step}</span>
    </div>
    <h2 className="text-[15px] font-semibold text-gray-900 tracking-[-0.01em]">{title}</h2>
  </div>
  <span className="font-mono text-[11.5px] text-gray-400 px-2 py-1 bg-white border border-gray-200 rounded-md">
    🔒 {guideName}
  </span>
</div>
```

### 7-2. `<ScopeNotice />`

```tsx
// shared 위치 표시 (guideMap[key].length >= 2 일 때만)
<div className="bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5 text-[13px] text-blue-900">
  이 가이드는 <strong>{count}곳</strong>에서 사용됩니다.
  <span className="text-blue-700"> 저장 시 모든 곳에 반영됩니다.</span>
</div>
```

### 7-3. `<EditorFrame />` wrapper — Tiptap 영역 감싸기

```tsx
<div className={cardStyles.editorFrame}>
  <div className={cardStyles.toolbarSurface}>
    <EditorToolbar ... />
  </div>
  <EditorContent editor={editor} className="px-4 py-3 min-h-[300px] text-[14px]" />
  <div className="border-t border-gray-100 px-4 py-2 text-[11.5px] text-gray-400">
    Markdown 단축키: ⌘B / ⌘I / ⌘E / ⌘K
  </div>
</div>
```

## Step 8: `EditorToolbar.tsx` — 30×30 grid + active 흰 카드 그림자 (~30 LOC delta)

design 시안 라인 535–561 참고.

```tsx
// 각 버튼
<button
  type="button"
  className={cn(
    cardStyles.toolbarBtn,
    isActive && cardStyles.toolbarBtnActive,
    disabled && 'opacity-40 cursor-not-allowed'
  )}
>
  {icon}
</button>

// divider (그룹 간 구분)
<span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />
```

> 그룹 구성 (HTML 라인 549–559 참고): `[H4]` `|` `[B] [I] [</>]` `|` `[•] [1.]` `|` `[🔗]`

## Step 9: `ProcessTimelineCompact.tsx` — 7-grid + halo glow (~40 LOC delta)

design 시안 라인 702–735 참고.

```tsx
// 7-column grid + 가운데 가로 connector line + 활성 dot 에 halo
<div role="img" aria-label={`${current}단계 / 총 ${total}단계`} className="relative grid grid-cols-7 items-center px-2 py-3">
  {/* connector line — absolute, dots 중앙 통과 */}
  <span className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-1/2 h-px bg-gray-200" aria-hidden />
  {Array.from({ length: total }).map((_, idx) => {
    const step = idx + 1;
    const isCurrent = step === current;
    const isPast = step < current;
    return (
      <div key={step} className="relative flex flex-col items-center gap-1.5 z-10">
        <span className={cn(
          'w-3.5 h-3.5 rounded-full bg-white border-2 transition-colors',
          isCurrent ? 'border-blue-600 bg-blue-600' : isPast ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
          isCurrent && primaryColors.haloRing  // 0 0 0 4px ring
        )} />
        <span className={cn(
          'text-[10.5px] font-medium tabular-nums',
          isCurrent ? 'text-blue-600' : 'text-gray-400'
        )}>{step}</span>
      </div>
    );
  })}
</div>
```

> ⚠️ connector line 위치는 `left-[calc(100%/14)] right-[calc(100%/14)]` — dot 중심점이 각 column의 중앙이고, 양 끝 dot은 column 폭의 절반만큼 안쪽에 있으므로 1/14 (= 7 columns × 2).

## Step 10: `GuidePlaceholder.tsx` — Empty pane 시각 (~25 LOC delta)

design 시안 라인 793–806 참고.

```tsx
<div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
  <span aria-hidden className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 text-gray-400">
    {/* lucide 아이콘 — Edit3 또는 Eye, 사용처에 따라 */}
    <Edit3 className="w-6 h-6" />
  </span>
  <div className="flex flex-col gap-0.5">
    <p className="text-[14px] font-semibold text-gray-700">{children}</p>
    <p className="text-[12.5px] text-gray-500">{subtitle ?? '좌측 목록에서 단계를 선택해주세요'}</p>
  </div>
</div>
```

> Props 확장: `children` (헤딩), `subtitle?` (보조 문구), `icon?` (선택). 기본 `children` = "편집할 단계를 선택해주세요" (편집 자리), "미리보기 영역" 자리는 props 로 전달.

## Step 11: `UnsavedChangesModal.tsx` — radius 14 (~5 LOC delta)

design 시안 라인 872–887 참고. 프로젝트 `Modal` 컴포넌트가 이미 `rounded-xl` (12px) 이면 14px override 필요. 가능하면 `Modal` 컴포넌트의 size prop 또는 className 으로 전달.

```tsx
<Modal isOpen={isOpen} onClose={onCancel} title="저장되지 않은 변경사항" className="rounded-[14px]">
  ...
</Modal>
```

> Modal 내부가 `rounded-xl` 하드코딩이면 W3-d 스코프에서 별도 prop 추가는 하지 않고, 시각 차이 ≤2px 는 deferred 로 표기.

## Step 12: 검증

```bash
npx tsc --noEmit
npm run lint -- app/integration/admin/guides app/components/features/process-status lib/theme.ts
npm run test:run -- guide
npm run build
USE_MOCK_DATA=true npm run dev
```

브라우저 비교 (`/integration/admin/guides` 와 `design/guide-cms/guide-cms.html` 시안 동시):

- [ ] **Page chrome**: breadcrumb + 24px page title + 13.5px subtitle 노출
- [ ] **ProviderTabs**: 5 탭 모두 컬러 dot, IDC/SDU 옆 "준비 중" chip
- [ ] **StepList**: 행 간 gap (border-b 없음), 선택 행 좌측 3px bar + 푸른 tinted bg + step-no 흰 채움 → 푸른 채움
- [ ] **공유 hint**: share 아이콘 + "2곳 공유"
- [ ] **AWS step 4**: AUTO chip 푸른색 / MANUAL chip 호박색
- [ ] **EditorHeader**: gray-50 박스 + 🔒 mono badge
- [ ] **ScopeNotice**: blue-tint 카드 + blue-200 border
- [ ] **EditLangTabs**: pill segmented (muted bg + 활성 흰 카드 + soft shadow)
- [ ] **PreviewLangToggle**: 동일 pill segmented
- [ ] **EditorToolbar**: 30×30 buttons in muted bar, 활성 = 흰 카드 + soft shadow
- [ ] **EditorFrame**: 단일 border + radius-8 + footer hint
- [ ] **Timeline**: 7-grid, connector line 도트 통과, 활성 도트에 4px halo
- [ ] **Empty pane**: 56×56 muted icon + 헤딩 + 부제 2줄
- [ ] **UnsavedModal**: 14px radius (또는 12px deferred)
- [ ] **Geist 폰트**: 페이지 전반 적용 (next/font 통해 — 추가 import 없이 자동)
- [ ] **CLAUDE.md ⛔#4**: raw color class 0 (모두 theme 토큰 경유)

## Out of scope

- 키보드 nav, debounce 250ms, dirty guard 로직, save state machine, validation 계약, Tiptap 확장, mock API
- IDC/SDU 활성화 (별도 wave — Step 구조 확정 후)
- Tiptap 자체 폰트 (Tiptap 기본 사용; 필요 시 후속 wave)
- Modal 컴포넌트 자체 radius 변경 (광범위 영향 — deferred)

## PR body checklist

- [ ] `lib/theme.ts` 토큰 추가 (primaryColors.bg50/100/border100, borderColors light/strong, shadows.pill, chipStyles, segmentedControlStyles, pageChromeStyles, cardStyles.editorFrame/toolbar*)
- [ ] page.tsx breadcrumb + page-header
- [ ] ProviderTabs provider dot + "준비 중" chip
- [ ] StepListPanel 행 시각 재작업
- [ ] EditLanguageTabs + PreviewLanguageToggle pill segmented
- [ ] GuideEditorPanel header card + scope-notice + editor-frame
- [ ] EditorToolbar 30×30 grid in muted bar
- [ ] ProcessTimelineCompact 7-grid + halo
- [ ] GuidePlaceholder empty pane 시각
- [ ] UnsavedChangesModal radius (또는 deferred 표기)
- [ ] raw color class 0 (`grep -rE "bg-(red|orange|amber|yellow|green|emerald|teal|cyan|blue|indigo|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-[0-9]" app/integration/admin/guides app/components/features/process-status/ProcessTimelineCompact.tsx | grep -v theme.ts` 결과 0)
- [ ] tsc 0, lint 0 new, test pass, build 0
- [ ] Dev smoke — 시안 HTML 과 픽셀 비교 통과

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W3-d-design-polish.md` @ <SHA>
- Wave: W3-d (visual polish only — behavior unchanged)
- 의존: W3-a/b/c (모두 머지)

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test:run — relevant tests pass
- [ ] npm run build — exit 0
- [ ] Dev smoke — 시안 HTML 과 좌우 비교: page chrome, ProviderTabs, StepList, segmented controls, editor frame, timeline halo 모두 일치
- [ ] raw color class grep — 0 (CLAUDE.md ⛔#4)

## Visual diffs (스크린샷 첨부 권장)
- /integration/admin/guides 진입 화면 vs guide-cms.html 라인 962~973
- StepList 선택 row vs 라인 445~499
- Editor pane vs 라인 502~617
- Preview pane vs 라인 691~735

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<예: UnsavedChangesModal radius 14px — Modal 컴포넌트 자체가 rounded-xl 고정이라 W3-d 스코프 밖>
```
