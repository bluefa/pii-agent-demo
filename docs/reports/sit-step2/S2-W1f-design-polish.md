# S2-W1f — Design Polish (시안 픽셀 정합)

> **Recommended model**: Sonnet 4.6 (행동 변경 없음 — token 매핑 + 클래스 교체 위주)
> **Estimated LOC**: ~120 (대부분 클래스 변경, 신규 토큰 ~30 LOC)
> **Branch prefix**: `feat/sit-step2-w1f-design-polish`
> **Depends on**: S2-W1c, S2-W1d, S2-W1e (모두 머지)

## Context

W1c~W1e 가 마친 후 시안 `design/app/SIT Prototype v2.html` 와 실제 화면을 나란히 띄웠을 때 **픽셀 단위로 일치**시키는 visual-only 폴리시.

**행동 / 카피 / 컴포넌트 트리 변경 절대 금지**. 본 wave 에서 변경 가능한 것:

- `lib/theme.ts` 토큰 추가 (raw class → token 정리)
- 컴포넌트 className 교체 (raw → token)
- spacing / radius / shadow 미세 조정
- focus / hover state visual

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/ui/StepBanner.tsx ] || { echo "✗ S2-W1c 미머지"; exit 1; }
[ -f app/components/ui/ConfirmStepModal.tsx ] || { echo "✗ S2-W1d 미머지"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalReselectButton.tsx ] || { echo "✗ S2-W1e 미머지"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1–815 (`<style>` 블록 전체) — 시각 토큰 source of truth
2. `design/app/SIT Prototype v2.html` line 1535–1610 — Step 2 본문
3. `design/app/SIT Prototype v2.html` line 2300–2326 — confirmStepModal
4. `design/colors_and_type.css` — global CSS variable 정의
5. `lib/theme.ts` — 현재 토큰
6. W1c/d/e 머지된 컴포넌트들 (수정 대상)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1f-design-polish --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1f-design-polish
```

## Step 2: `lib/theme.ts` 토큰 추가

### 2.1. `bannerStyles` 신규 그룹

```ts
export const bannerStyles = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
  },
  warn: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    iconBg: 'bg-red-100',
    iconText: 'text-red-700',
  },
} as const;
```

### 2.2. `buttonStyles.dangerOutline` / `buttonStyles.warnOutline` 추가

시안 line 197–266 의 `.btn.danger-outline` / `.btn.warn-outline` 매핑.

```ts
export const buttonStyles = {
  // ... 기존
  dangerOutline:
    'inline-flex items-center px-3 py-2 text-[13px] font-medium ' +
    'rounded-lg border border-red-200 bg-red-50 text-red-800 ' +
    'hover:bg-red-100 hover:border-red-300 ' +
    'transition-colors duration-150 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  warnOutline:
    'inline-flex items-center px-3 py-2 text-[13px] font-medium ' +
    'rounded-lg border border-amber-300 bg-amber-50 text-amber-900 ' +
    'hover:bg-amber-100 hover:border-amber-400 ' +
    'transition-colors duration-150 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
} as const;
```

### 2.3. `tagStyles` 신규 (Step 2 테이블 cell)

```ts
export const tagStyles = {
  info:    'inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-blue-100   text-blue-800',
  success: 'inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-emerald-100 text-emerald-800',
  neutral: 'inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-gray-100   text-gray-700',
  warning: 'inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-amber-100  text-amber-800',
} as const;
```

→ "대상" → `tagStyles.success`, "비대상" → `tagStyles.neutral`, DB Type → `tagStyles.info`.

### 2.4. `noteStyles.warning` 신규 (ConfirmStepModal note)

```ts
export const noteStyles = {
  warning: 'rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2.5 text-[12px] leading-[1.55]',
} as const;
```

### 2.5. `radii` / `shadows` 토큰 (옵션)

시안 line 803 의 `border-radius: 10px` 가 Tailwind default 에 없음 — 토큰화:

```ts
export const radii = {
  banner: 'rounded-[10px]',     // step-banner
  card: 'rounded-xl',           // 12px
  modal: 'rounded-xl',          // 12px
  button: 'rounded-lg',         // 8px
} as const;
```

## Step 3: 컴포넌트 클래스 교체

### 3.1. `StepBanner.tsx` (W1c 산출물)

W1c 에서 임시 inline 클래스로 작성한 부분을 `bannerStyles[variant]` + `radii.banner` 로 교체.

```tsx
// 변경 전
const variantStyles: Record<BannerVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  // ...
};

// 변경 후
import { bannerStyles, radii, cn } from '@/lib/theme';

<div className={cn(
  'flex items-center gap-3 px-4 py-3 mb-4 border text-[13px]',
  radii.banner,
  bannerStyles[variant].bg,
  bannerStyles[variant].border,
  bannerStyles[variant].text,
)}>
```

### 3.2. `WaitingApprovalCancelButton.tsx` / `WaitingApprovalReselectButton.tsx`

`buttonStyles.dangerOutline` / `buttonStyles.primary` 사용으로 통일.

### 3.3. `ConfirmStepModal.tsx`

- iconCircle 의 색상 → `bannerStyles[iconVariant].iconBg/iconText`
- note → `noteStyles.warning`
- 외곽 modal → `radii.modal` + 기존 `shadow-xl`
- backdrop / focus 동작 변경 없음

### 3.4. `WaitingApprovalTable.tsx`

- "대상" / "비대상" → `tagStyles.success` / `tagStyles.neutral`
- "DB Type" 셀 (MySQL 등) → `tagStyles.info`
- mono 셀 → 공통 클래스 추출 (`mono-cell-style` 같은 이름으로 theme.ts 에 추가하거나 inline)

### 3.5. `RejectionAlert.tsx` (W1e 산출물)

이미 `StepBanner variant="error"` 사용 — 본 wave 에서 변경 없음.

## Step 4: Spacing / Padding 미세 조정

시안 line 별 정확한 값으로 맞춤:

| 요소 | 시안 값 | 대응 클래스 |
|---|---|---|
| 카드 본문 padding | 24px (p-6) | `p-6` |
| 카드 헤더 padding | 16px 24px (px-6 py-4) | `px-6 py-4` |
| 테이블 헤더 padding | 12px 24px (px-6 py-3) | `px-6 py-3` |
| 테이블 셀 padding | 16px 24px (px-6 py-4) | `px-6 py-4` |
| Banner padding | 14px 18px (px-4 py-3 ≈) | `px-[18px] py-[14px]` (정밀 매칭 시) |
| Modal width | 440px | `w-[440px]` |
| Modal header padding | 28px 28px 12px | `px-7 pt-7 pb-3` |
| Modal footer padding | 16px 28px 28px | `px-7 pt-4 pb-7` |
| iconCircle | 38×38 + radius 999px | `w-[38px] h-[38px] rounded-full` |

→ 위에서 inline arbitrary `[14px]` 같은 값을 쓸 때는 **theme.ts spacing 토큰으로 추출** 권장 (`spacing.bannerY`, `spacing.modalHeaderX` 등). 본 wave 에서는 한 번 추출 후 컴포넌트에서 토큰 사용.

## Step 5: Focus / Hover state

- 모든 버튼: `:focus-visible` → 2px primary blue ring + offset 2px (글로벌 `:focus-visible` 이 적용 — 이미 globals.css 에 정의되어 있는지 확인).
- 테이블 행 hover: `hover:bg-gray-50` (시안 정합).
- 모달 backdrop click: 시각적 변화 없음 (carry-over from W1d).

## Step 6: 시안 픽셀 비교 체크리스트

작업 후 dev 서버 띄우고 시안 HTML 과 나란히 비교:

```bash
USE_MOCK_DATA=true npm run dev
# 별도 탭에서 design/app/SIT Prototype v2.html 직접 열기 (file://)
```

체크 항목:
- [ ] 카드 외곽 radius / shadow 동일
- [ ] 카드 헤더 sub-text 색상 (gray-500 vs --fg-3)
- [ ] Status pill (`승인 대기`) 색상/패딩 동일
- [ ] StepBanner 의 border / bg / radius / icon 정렬
- [ ] 테이블 헤더 typography (uppercase / tracking / 색상)
- [ ] 테이블 행 hover bg
- [ ] mono 셀 font-size
- [ ] 버튼 padding / font-weight / hover
- [ ] 모달 width / padding / iconCircle / note bg
- [ ] 모달 footer 버튼 정렬

차이가 발견되면 token 만 수정. 컴포넌트 트리 / 카피 변경 금지.

## Step 7: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가 검증:
- raw hex 0건:
  ```bash
  grep -rnE "#[0-9a-fA-F]{3,6}" app/components/ui/ app/integration/target-sources/'[targetSourceId]'/_components/ | grep -v "fill=\"#" | grep -v "stroke=\"#"
  ```
  → SVG 의 fill/stroke 외 0 matches.
- arbitrary value `[…]` 사용은 theme.ts 안에서만:
  ```bash
  grep -nE "\[[0-9]+px\]" app/components/ app/integration/target-sources/ | grep -v "lib/theme.ts"
  ```
  → 0 matches (또는 모두 의도된 것 — review 시 justify).
- behavior 회귀 테스트 — W1c/d/e 의 모든 테스트 그대로 통과:
  ```bash
  npm run test -- WaitingApproval ConfirmStepModal RejectionAlert StepBanner
  ```

## Step 8: Verify

```bash
npx tsc --noEmit
npm run lint
npm run test
USE_MOCK_DATA=true npm run dev   # 시각 비교 (Step 6)
```

## Step 9: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1f-design-polish.md` @ <SHA>
- Wave: S2-W1f
- 의존: S2-W1c, S2-W1d, S2-W1e (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1–815 (tokens) + 1535–1610 (Step 2) + 2300–2326 (modal)

## Changed files
- lib/theme.ts — bannerStyles / buttonStyles 확장 / tagStyles / noteStyles / radii
- app/components/ui/StepBanner.tsx — token 교체
- app/components/ui/ConfirmStepModal.tsx — token 교체
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton.tsx — token
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton.tsx — token
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx — token
- app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx — (변경 없음 또는 minor)

## Manual verification
- [ ] 시안 HTML 과 dev 서버 화면 픽셀 비교 — 스크린샷 첨부 (4장: 정상 대기 / 반려 / 취소 모달 / 다시 선택 모달)
- [ ] raw hex 검사 0건
- [ ] 기존 테스트 모두 그대로 통과 (행동 변경 없음)

## Deferred
- ConfirmStepModal 의 Step 6/7 재사용 (후속 wave)
- 다른 Step (3,4,5,6,7) 의 visual polish (각 wave 내부에서 진행)
```

## ⛔ 금지

- 행동 변경 (이벤트 핸들러 / state machine / API 호출 흐름).
- 카피 변경.
- 컴포넌트 트리 변경 (slot 추가/제거 등).
- 신규 컴포넌트 추가 (W1c/d/e 가 만든 것 외).
- raw hex 도입 (오히려 raw 를 token 으로 정리하는 wave).
- 다른 Step / 다른 페이지 token 정리 — 본 wave 는 Step 2 한정. 글로벌 정리는 별도 issue.
