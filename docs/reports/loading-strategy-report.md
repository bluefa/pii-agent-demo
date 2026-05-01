# Loading Strategy Report — 현황 진단 및 4-Tier 표준 제안

> 작성일: 2026-05-01
> 상태: Draft (ADR 작성 전 사전 분석 문서)
> 다음 산출물: `docs/adr/014-loading-strategy.md` 초안 + DESIGN.md `loading:` / `motion:` 토큰 섹션 추가

이 문서는 PII Agent 프론트엔드의 **Loading 처리 현황을 점검하고**, Toss 톤에 맞는 **4-Tier 표준 안**을 제시하기 위한 사전 분석입니다. 아이디어 평가와 외부 리서치 프롬프트도 함께 정리되어 있어, ADR 작성 시 그대로 인용/흡수할 수 있도록 구성했습니다.

---

## 0. 요약 (TL;DR)

| 영역 | 현황 | 결정 필요 사항 |
|---|---|---|
| **Component-level (Skeleton/Spinner)** | `LoadingSpinner` 1개만 표준. Skeleton·로딩 텍스트는 7+곳에 ad-hoc raw hex/스타일로 흩어져 있음 (⛔ #4 위반 다수) | 표준 `<Skeleton>`, `<TextDots>` 도입 + 토큰화 |
| **Button action-level** | `useApiMutation` 훅 표준은 일관. 그러나 `Button`이 `loading` prop을 모름 → 12+ 호출처가 매번 `<LoadingSpinner>` 손으로 끼움 | `<Button loading>` prop 도입으로 호출처 일괄 단순화 |
| **Page/route-level** | `app/**/loading.tsx` **0개** — Next.js Suspense 미사용. `'use client'` + `useEffect` + 카드 단위 `loading` prop 일변도 | 최소 `app/integration/admin/`, `app/integration/target-sources/[id]/`에 `loading.tsx` 도입 |
| **사용자 아이디어 — 버튼 diagonal sweep** | DESIGN.md "refined and utilitarian" 톤과 충돌. Toss 본가도 버튼 sweep 미사용 | **버튼이 아닌 Skeleton의 shimmer로 위치 이동 권장** |
| **사용자 아이디어 — `…` 점 애니메이션** | "확인 중...", "로딩 중..." 등 7+ 곳 하드코딩 텍스트로 박혀 있음 | `<TextDots>` 단일 컴포넌트로 통일 (aria-live + reduced-motion 책임을 한 곳에) |

핵심 결손은 **표준 컴포넌트의 부재**이고, 이미 `memory/toss-design-research.md` (2026-02-18) 가이드(5초 임계, shake 0.5s 등)를 부분적으로만 이행하고 있다는 점입니다.

---

## 1. 현황 진단

### A. Component-level — 흩어진 ad-hoc 패턴

| 종류 | 파일 | 비고 |
|---|---|---|
| **공용 spinner** | `app/components/ui/LoadingSpinner.tsx:14` | 단 1개 — sm/md/lg 3 size, currentColor 기반. 잘 만들어져 있음. |
| **Skeleton (테이블 행)** | `app/components/features/dashboard/systems-table/SkeletonRow.tsx:5` | `bg-[#f3f4f6]` 인라인 hex (⛔ #4 위반) |
| **Skeleton (KPI 카드)** | `app/components/features/dashboard/KpiCardGrid.tsx:43` | `style={{ backgroundColor: '#e5e7eb' }}` 인라인 hex |
| **Skeleton (Guide 카드)** | `app/components/features/process-status/GuideCard/GuideCardSkeleton.tsx:4` + `GuideCardChrome.tsx:18` | 유일하게 토큰 사용(`cardStyles.warmVariant.skeletonBar`), `aria-busy` / `aria-live` 적용 — **표준의 모범** |
| **Skeleton (인프라 행)** | `app/components/features/admin/infrastructure/InfraCardBody.tsx:19` | `bg-gray-100` raw 클래스 |
| **자체 spinner 변형** | `app/components/ui/HistoryTable/HistoryTable.tsx:36`, `app/integration/.../common/LoadingState.tsx:7`, `app/components/features/process-status/shared/InstallationLoadingView.tsx:12`, `app/components/features/scan/ScanRunningState.tsx:21` | 매번 다른 사이즈/색/굵기로 SVG 작성. `LoadingSpinner` 미사용 |
| **로딩 텍스트** | 7곳 이상 | "로딩 중..." / "갱신 중" / "테스트 진행 중..." / "내역 로딩 중..." 표현이 제각각 |

**진단**: `LoadingSpinner`만 표준이고, **Skeleton·로딩 텍스트·진행 표시는 컴포넌트마다 색·리듬·접근성 처리가 다르다.** `aria-busy` / `aria-live` 적용은 `GuideCardChrome` 1곳뿐.

### B. Button action-level — 패턴은 일관, 추상화는 부재

훅 표준은 잘 잡혀 있음 — `app/hooks/useApiMutation.ts:60`이 `loading` 상태를 노출하고, 12+개 컴포넌트가 이를 그대로 `disabled` / spinner 자리에 흘려넣음.

**반복되는 호출 패턴** (예: `ApprovalDetailModal.tsx:110`, `CandidateResourceTable.tsx:108`, `ConnectionTestPanel.tsx:161`):

```tsx
<Button disabled={loading} onClick={...} className="flex items-center gap-2">
  {loading && <LoadingSpinner size="sm" />}
  승인
</Button>
```

**문제**:

1. `Button` (`app/components/ui/Button.tsx:20`)이 `loading` prop을 모름 → 12+ 호출처가 매번 `<LoadingSpinner>`를 손으로 끼움.
2. 시각 변화는 `disabled:opacity-50` (`lib/theme.ts:179`) 한 줄뿐 — 클릭 직후 "내가 눌렀는지 시스템이 받았는지" 피드백이 약함.
3. 텍스트 변경 여부 (`'테스트 진행 중...' : '연결 테스트 수행'` vs `'승인'` 그대로) 가 화면마다 들쭉날쭉.

### C. Page/route-level — 부재

```bash
$ find app -name "loading.tsx"   # → 0건
```

App Router의 `loading.tsx` / Suspense 경계를 **단 한 곳도 사용하지 않는다.** 모든 페이지가 `'use client'` + `useEffect`로 페칭하고, 결과를 카드/테이블의 `loading` prop에 위임. `target-sources/[id]/_components/common/LoadingState.tsx`가 그나마 풀스크린 fallback이지만 **1곳에서만 사용**되며, 그 안에 `border-blue-500 border-t-transparent` raw 클래스가 박혀 있음 (해당 파일 7라인 TODO 코멘트도 그 점을 지적).

### D. 메모리에 이미 있는 Toss 가이드 (2026-02-18 기록)

`memory/toss-design-research.md`에 이미 정의돼 있음:

- 5초 미만 → 버튼 내부 spinner
- 5초 이상 → progress bar + 진행률 텍스트 ("3/7 완료")
- 상태 전환 → shake 0.5초 (이미 `app/globals.css:74-81`에 `--animate-shake` 키프레임 존재, `ConnectionTestPanel`에서 사용 중)

→ **현재 구현은 이 가이드를 부분적으로만 따르고 있고, 표준 컴포넌트로 박제되지 않은 게 핵심 결손.**

---

## 2. 사용자 아이디어 평가 (push back 포함)

### 아이디어 ① 버튼 클릭 시 좌상단→우하단 색 sweep

**평가: 위치를 옮기면 좋은 아이디어 — 버튼이 아닌 Skeleton으로.**

- DESIGN.md L84: *"refined and utilitarian — neutral surfaces ... operators use this product for hours at a time"*. Diagonal sweep은 게이밍/SaaS 마케팅 페이지의 어휘이고, **operator가 하루 8시간 보는 admin 화면에서 반복되면 시각 피로가 생깁니다.**
- Toss 본가도 버튼 내부에서 sweep을 쓰지 않습니다. Toss의 버튼 로딩은 (a) 즉시 disabled + spinner, (b) 5초+ 시 외부에 progress bar로 분리 — 단순한 두 단계입니다.
- 다만 sweep 자체는 매우 좋은 도구입니다 — **위치를 바꾸면 됩니다**: 버튼이 아니라 **Skeleton의 shimmer** (좌→우 밝은 띠가 흐르는 패턴) 에 적용하면 정확히 Toss 톤과 일치합니다.

### 아이디어 ② `…` 점 반복 애니메이션

**평가: 채택하되 단일 컴포넌트로 통일.**

- 현재 코드에 "확인 중...", "로딩 중...", "테스트 진행 중..." 등 점 3개가 **하드코딩 텍스트**로 7+곳에 박혀 있습니다. 애니메이션 없이.
- 이걸 `<TextDots>` 1개로 통일하면 (a) 모든 곳이 자동으로 살아 움직이고, (b) `aria-live="polite"` + `prefers-reduced-motion` 분기를 한 곳에서 책임집니다. 그렇지 않으면 스크린리더가 "점 점 점"을 반복 낭독합니다.

### 아이디어 ③ Component 로딩에 Skeleton

**평가: 즉시 채택. 이미 부분적으로 도입돼 있고, 표준화만 남음.**

- `GuideCardSkeleton`이 `aria-busy` / `aria-live`까지 적용한 모범 사례.
- `KpiCardGrid` / `SystemsTable`의 SkeletonRow 등은 **레이아웃은 맞지만 색·리듬이 raw hex** — 토큰화만 하면 일괄 정리 가능.

---

## 3. 제안 — Loading 4-Tier 표준 (DESIGN.md 추가 + ADR 토대)

DESIGN.md의 `components:` 섹션처럼 **레벨별 사양을 토큰화**하는 형태입니다.

### L1. Inline (버튼/액션 내부, < 300ms 시작)

- **컴포넌트**: `<Button loading>` prop으로 흡수 (현재 호출처의 12+ 중복 제거)
- **시각**: `disabled` + 좌측 `LoadingSpinner size="sm"` + 텍스트는 그대로 유지 (텍스트 변경은 옵션). `disabled:opacity-50` → **`loading:opacity-100 + cursor-progress`로 분리** (눌렀다는 게 보여야 함)
- **시간 임계**: 작업이 1초를 넘으면 텍스트 옆 `<TextDots />` 가 자동 노출

### L2. Local (카드/섹션, 300ms ~ 3s)

- **컴포넌트**: `<Skeleton variant="text|rect|circle">` + `<SkeletonRow cols={N}>` 표준화
- **시각**: 단일 토큰 `skeletonStyles.bg` (권장: `bg-gray-100`) + **shimmer 그라디언트 (좌→우)** — 사용자 의견의 sweep을 여기로 이동
- **접근성**: 컨테이너에 `aria-busy="true" aria-live="polite"` 강제 (`GuideCardChrome` 패턴을 표준으로 승격)

### L3. Operation (장시간 작업, 3s+)

- **컴포넌트**: `<ProgressBar value={n} total={m} label="…">` (현재 `connection-test/ProgressBar.tsx`, `ScanRunningState`에 비슷한 게 따로 있음 — 통합)
- **시각**: 1차 결정형 (determinate) 우선. 진행률 미상이면 indeterminate shimmer
- **텍스트**: "3/7 리소스 완료" 형태 강제 (메모리의 Toss 가이드 그대로)

### L4. Route (페이지 전환)

- **메커니즘**: Next.js `app/.../loading.tsx` Suspense boundary 도입
- **위치 (최소)**: `app/integration/admin/loading.tsx`, `app/integration/target-sources/[targetSourceId]/loading.tsx`
- **시각**: L2의 Skeleton을 페이지 레이아웃 형태로 그대로 씌움 (CLS 방지)

---

## 4. 토큰 / 컴포넌트 추가 사양 (DESIGN.md / theme.ts 패치 초안)

### DESIGN.md `colors:` / 새 키프레임 섹션

```yaml
loading:
  skeleton-bg:        "{colors.surface-tertiary}"   # gray-100
  skeleton-shimmer:   "rgba(255,255,255,0.6)"
  spinner-track:      "{colors.border-default}"
  spinner-indicator:  "{colors.primary}"
motion:
  shimmer-duration:   1.4s
  shimmer-easing:     ease-in-out
  dots-period:        1.2s
  reduced-motion:     fallback to opacity pulse only
```

### `lib/theme.ts` 추가 토큰 (예시)

```ts
export const skeletonStyles = {
  bg: 'bg-gray-100',
  shimmer: 'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
  // ...
} as const;

export const buttonStyles = {
  // 기존 ...
  loadingState: 'opacity-100 cursor-progress', // disabled:opacity-50 의 로딩 변형
} as const;
```

### `app/globals.css` 추가 keyframes

```css
@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@keyframes dots    { 0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  /* shimmer/dots → opacity pulse only fallback */
}
```

---

## 5. Anti-pattern 제거 체크리스트 (ADR "결과" 섹션 후보)

- [ ] `SkeletonRow.tsx:11`, `KpiCardGrid.tsx:48-51`, `LoadingState.tsx:7`, `InfraCardBody.tsx:21`의 raw hex / 색 클래스 제거 → 신규 `skeletonStyles` 토큰으로
- [ ] 6개 ad-hoc spinner SVG (`HistoryTable`, `LoadingState`, `InstallationLoadingView`, `ScanRunningState`, `AdminDashboard.tsx:289`, `ProgressBar`) → 모두 `LoadingSpinner` 사용
- [ ] 7+ 곳 하드코딩 "...{지점}" → `<TextDots />`
- [ ] 12+ 호출처의 `<Button>{loading && <LoadingSpinner …/>}…` 패턴 → `<Button loading>` prop 한 줄로
- [ ] `app/integration/admin/loading.tsx`, `app/integration/target-sources/[targetSourceId]/loading.tsx` 신규 생성

---

## 6. 추가 리서치 — ChatGPT에 맡길 항목과 그대로 쓸 프롬프트

리서치가 필요한 이유는 두 가지입니다:

1. Toss·Linear·Vercel 같은 레퍼런스의 **시간 임계값 (threshold) 이 실제로 몇 ms인지** 일차자료를 모은 적이 없음
2. shimmer / dots 애니메이션은 GPU 친화적 구현법이 정해져 있는데 추측으로 만들면 reflow 발생

세 프롬프트는 **각각 독립적으로** 던져도 되고, 결과를 합쳐서 ADR-014 (가칭) 작성 근거로 사용하면 됩니다.

### 리서치 프롬프트 #1 — 모던 admin/SaaS의 Loading 시간 임계값 표준

```
You are a senior frontend designer auditing loading-state UX for an enterprise
admin console (Next.js 14 App Router, Tailwind v4, desktop-only, dense data
tables and side-by-side panels). Tone is "refined and utilitarian" — no
marketing flourishes.

Research and produce a comparison table of loading-state thresholds and
patterns from these references (cite primary sources where possible):
1. Toss design system / Toss frontend blog (Korean)
2. Linear app
3. Vercel dashboard
4. Stripe dashboard
5. Notion
6. Material 3 progress indicators spec
7. Nielsen Norman Group articles on response times

For each, report:
- Threshold for "no indicator" vs "spinner" vs "skeleton" vs "progress bar"
  (in milliseconds, with citations)
- When they show button-internal spinners vs external progress
- When they use skeleton vs spinner vs blank
- Any minimum-display-time rule (to prevent flicker)

Then synthesize: a single recommended threshold table for an admin console
with 4 tiers — inline (button), local (card/section), operation (long task),
route (page transition). Output as Markdown.
Be skeptical: if a "best practice" only has secondhand sources, say so.
```

### 리서치 프롬프트 #2 — Shimmer / dots 애니메이션의 GPU 친화 구현

```
I need a CSS-only implementation of two loading micro-animations that must
run smoothly during heavy React re-renders on desktop Chrome/Safari/Firefox:

1. Skeleton shimmer — a light highlight band that sweeps left-to-right across
   a gray skeleton bar, infinite loop, ~1.4s period. The base bar is a solid
   color (#F3F4F6); the sweep is a translucent white gradient. Must not
   trigger layout/paint — only composite. Tailwind v4 + bare CSS keyframes,
   no JS, no inline styles.

2. Text dots — three trailing "…" dots after a label like "확인 중", where
   each dot fades in sequentially over ~1.2s and resets. Must collapse to a
   static "…" when prefers-reduced-motion: reduce.

Constraints:
- GPU compositing only: use transform/opacity, never width/height/background-position
- Respect prefers-reduced-motion at the keyframe level, not per call site
- aria-live behavior: shimmer container should be aria-busy=true; dots should
  not be re-announced every cycle by screen readers

Deliver: (a) the @keyframes blocks, (b) the React component for each
(<Skeleton variant="rect|text|circle"> and <TextDots>), (c) explanation of
why each property choice avoids reflow, (d) a Lighthouse/DevTools test plan
to verify "Composite Layers" only.
```

### 리서치 프롬프트 #3 — Button loading prop의 표준 API 비교

```
Compare the Button "loading" prop API across mature React UI libraries
(shadcn/ui, Radix Themes, Mantine, Chakra, Ant Design, MUI, NextUI, Tremor).
For each, capture:
- The prop name (loading vs isLoading vs pending)
- Whether the spinner replaces the text or sits beside it
- How they handle width stability (does the button shrink when text is
  replaced? do they preserve the original width?)
- Whether disabled is implied or must be set separately
- How the icon-only variant is handled
- The accessibility behavior (aria-busy, aria-disabled)

Then propose a minimal Button loading API for a project that already has
<Button variant="primary|secondary|danger"> and uses a shared LoadingSpinner
component. The API must be ONE prop, must preserve button width during
state change, and must not require callers to remember to set disabled.

Output: comparison table + a TypeScript interface diff for the proposed API.
```

---

## 7. 다음 단계

1. **본 문서 검토 → 4-tier 표준 합의**: 특히 "버튼 sweep을 Skeleton shimmer로 옮기는 안" 결정이 ADR 방향을 가름.
2. 합의 후:
   - DESIGN.md에 `loading:` / `motion:` 토큰 섹션 추가
   - `docs/adr/014-loading-strategy.md` 초안 작성
   - `<Button loading>` + `<Skeleton>` + `<TextDots>` + `<ProgressBar>` 표준 구현
   - 12+ 호출처 마이그레이션을 별 PR로 분리하여 진행
3. 리서치는 ChatGPT 결과를 받으면 ADR "맥락" 섹션에 인용 근거로 흡수.

---

## 부록 — 조사 시 확인된 코드 위치

### Loading 표현 전체 인벤토리 (file:line)

- `app/components/ui/LoadingSpinner.tsx:14` — 공용 spinner
- `app/components/ui/HistoryTable/HistoryTable.tsx:36` — 자체 spinner SVG
- `app/components/features/dashboard/systems-table/SkeletonRow.tsx:5` — raw hex
- `app/components/features/dashboard/KpiCardGrid.tsx:43` — raw hex inline style
- `app/components/features/process-status/GuideCard/GuideCardSkeleton.tsx:4` — 토큰 사용 (모범)
- `app/components/features/process-status/GuideCard/GuideCardChrome.tsx:11` — `aria-busy` / `aria-live` (모범)
- `app/components/features/process-status/shared/InstallationLoadingView.tsx:12` — 자체 spinner
- `app/components/features/admin/infrastructure/InfraCardBody.tsx:19` — raw class
- `app/components/features/scan/ScanRunningState.tsx:21` — 자체 SVG arc + gradient progress
- `app/components/features/scan/ScanProgressBar.tsx` — animate-spin
- `app/components/features/process-status/connection-test/ProgressBar.tsx:21` — `LoadingSpinner` + 진행률
- `app/integration/target-sources/[targetSourceId]/_components/common/LoadingState.tsx:7` — raw blue hex + TODO 코멘트
- `app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views.tsx:12` — `LoadingSpinner` 래핑
- `app/components/features/AdminDashboard.tsx:289` — 자체 inline border spin

### Button + loading state 호출처 (file:line)

- `app/components/features/admin/ApprovalDetailModal.tsx:94, 110-111`
- `app/components/features/process-status/ConnectionTestPanel.tsx:163-167`
- `app/components/features/process-status/CancelApprovalModal.tsx:51, 54`
- `app/components/features/process-status/ApprovalRequestModal.tsx:123, 127`
- `app/components/features/process-status/ApprovalModals.tsx:42, 45, 82, 85`
- `app/components/features/ProjectCreateModal.tsx:287`
- `app/components/features/process-status/connection-test/CredentialSetupModal.tsx:99`
- `app/components/features/process-status/connection-test/TestConnectionHistoryModal.tsx:86`
- `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable.tsx:108-114`
- `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection.tsx:198, 263`
- `app/integration/admin/guides/components/GuideEditorPanel.tsx:541, 589`

### Loading 텍스트 하드코딩 (file:line)

- `app/integration/target-sources/[targetSourceId]/_components/common/LoadingState.tsx:8` — "로딩 중..."
- `app/components/features/admin/infrastructure/InfrastructureList.tsx:38` — "로딩 중..."
- `app/components/features/process-status/ConnectionTestPanel.tsx:127, 167` — "연결 테스트 정보 로딩 중...", "테스트 진행 중..."
- `app/components/features/process-status/connection-test/TestConnectionHistoryModal.tsx:87` — "내역 로딩 중..."
- `app/components/features/process-status/connection-test/ProgressBar.tsx:22` — "연결 테스트 진행 중..."
- `app/components/features/queue-board/{ProcessingTasksTable,CompletedTasksTable,PendingTasksTable}.tsx` — "로딩 중..."
- `app/components/features/AdminDashboard.tsx:291` — "갱신 중"
