# S4G-W1c — Design Polish (Step 4 GCP 픽셀 정합)

> **Recommended model**: Sonnet 4.6 (행동 변경 없음 — token 매핑 + 클래스 교체)
> **Estimated LOC**: ~100 (대부분 클래스 변경 + theme.ts 토큰 추가)
> **Branch prefix**: `feat/sit-step4-gcp-w1c-design-polish`
> **Depends on**: S4G-W1a, S4G-W1b (모두 머지)

## Context

W1a (pipeline) + W1b (DB table + modal) 머지 후 시안과 픽셀 정합 final pass.

**행동 / 카피 / 컴포넌트 트리 변경 절대 금지**. 변경 가능한 것:

- `lib/theme.ts` 토큰 추가 (`tagStyles.error`, `tabStyles.segmented`, halo shadow 등)
- arbitrary value (`[…rgba…]`, `[10px]` 등) 의 token 추출
- 컴포넌트 className 교체 (raw → token)
- connector chevron 의 픽셀 정합

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx ] || { echo "✗ S4G-W1a 미머지"; exit 1; }
[ -f app/components/features/process-status/install-task-pipeline/Step4DbListTable.tsx ] || { echo "✗ S4G-W1b 미머지"; exit 1; }
[ -f app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal.tsx ] || { echo "✗ S4G-W1b 미머지"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1726–1789 (Step 4 GCP) + 2328–2360 (Modal) + 817–906 (CSS 전체)
2. W1a/W1b 산출 컴포넌트들
3. `lib/theme.ts` 현재 토큰 상태 (S2-W1f 가 추가한 것 확인)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step4-gcp-w1c-design-polish --prefix feat
```

## Step 2: `lib/theme.ts` 토큰 추가

### 2.1. `tagStyles` semantic alias 추가 (W1a/W1b 가 색상 키로 사용한 것을 의미 기반 alias 로 정리)

현재 `lib/theme.ts` 의 `tagStyles` 는 **색상 키만** (`blue/gray/green/red/orange/amber`). W1a/W1b 는 색상 키를 직접 사용했으나, semantic alias 로 일괄 정리:

```ts
export const tagStyles = {
  // 기존 색상 키 유지 (다른 사용처 보존)
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-700',
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  amber:  'bg-amber-100 text-amber-800',

  // ✨ 본 wave 가 추가하는 semantic alias
  success: 'bg-green-100 text-green-800',
  info:    'bg-blue-100 text-blue-800',
  warning: 'bg-orange-100 text-orange-800',
  error:   'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
} as const;
```

→ W1a/W1b 의 `tagStyles.green` / `tagStyles.blue` 등 색상 키 호출은 그대로 유지하되, 신규 코드는 semantic alias 사용 권장. 컴파일 에러 없음 (alias 가 색상 키와 같은 string).

**정리**: 본 wave 에서 W1a/W1b 컴포넌트 안의 색상 키 호출을 semantic alias 호출로 일괄 교체.

### 2.2. `tabStyles.segmented` 신규 그룹

W1b 의 `InstallTaskDetailModal` 탭 (시안 line 879–906):

```ts
export const tabStyles = {
  segmented: {
    container: 'inline-flex gap-1 p-1 rounded-lg',                    // outer + bg-muted
    containerBg: 'bg-gray-50',                                          // 시안 var(--bg-muted)
    item:    'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer text-gray-500',
    itemActive: 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    countBadge: 'inline-block min-w-[18px] px-1.5 py-px rounded-full text-[11px] font-bold text-center bg-gray-100 text-gray-500',
    countBadgeActive: 'bg-blue-50 text-blue-600',
  },
} as const;
```

### 2.3. `radii` / `shadows` 추가 (옵션)

```ts
export const radii = {
  // ... 기존
  pipeline: 'rounded-[10px]',     // install-task first/last
} as const;

export const shadows = {
  // ... 기존
  haloPrimary: 'shadow-[0_0_0_4px_rgba(0,100,255,0.15)]',  // .install-task.running .num
  pillSubtle:  'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',       // active tab
} as const;
```

## Step 3: 컴포넌트 클래스 교체

### 3.1. `InstallTaskCard.tsx`

- `bg-emerald-500 text-white` → `statusColors.success.bg + .textOn` (또는 token 추가)
- `bg-blue-600 text-white shadow-[0_0_0_4px_rgba(0,100,255,0.15)]` → token 조합 (`primaryColors.bgStrong + textOn + shadows.haloPrimary`)
- `bg-red-500 text-white` → `statusColors.error.bg + textOn`
- `rounded-l-[10px]` / `rounded-r-[10px]` → `radii.pipeline` 변형 (또는 inline 유지)
- pill style (`tagStyles.success/info/error/neutral`) 교체
- arbitrary `[18px]` `[22px]` padding → token 추출 검토 (또는 inline 유지하고 self-audit pass)

### 3.2. `InstallTaskPipeline.tsx`

- connector chevron 정합 검증. 시안 line 836–846 의 `::after` 와 픽셀 비교.
- 옵션 (a) inline `<ConnectorChevron />` 유지 + 위치 미세 조정
- 옵션 (b) CSS module 도입하여 `::after` 그대로 이식
- **결정**: 본 wave 에서 (a) 유지 + 픽셀 보정. CSS module 도입은 별도 issue.

### 3.3. `Step4DbListTable.tsx`

- `tagStyles.success` (완료) / `tagStyles.warning` (진행중) / `tagStyles.error` (실패)
- 헤더 typography → `tableStyles.headerCell` 일관 적용
- 행 hover bg → `tableStyles.row`

### 3.4. `InstallTaskDetailModal.tsx`

- 탭 → `tabStyles.segmented` 사용
- 탭 카운트 badge → `tabStyles.segmented.countBadge` / `countBadgeActive`
- modal 외곽 → 공용 modal token (S2-W1d / S2-W1f 산출과 동기화)
- footer 확인 버튼 → `buttonStyles.primary`

## Step 4: Spacing / Padding 미세 조정

| 요소 | 시안 값 | 클래스 |
|---|---|---|
| 카드 padding | 22px 18px 20px | `pt-[22px] px-[18px] pb-5` |
| 카드 gap (carousel) | 0 | `gap-0` |
| `.num` 크기 | 30×30 | `w-[30px] h-[30px]` |
| pill padding | 4px 12px | `px-3 py-1` |
| Modal width | `.logical-modal { width: 880px }` (시안 line 915–917) | `w-[880px]` |
| Modal header padding | 28px 28px 12px | `px-7 pt-7 pb-3` (S2-W1f 의 modal token 재사용) |
| Modal footer padding | 16px 28px 28px | S2-W1f 의 modal token 재사용 |
| 탭 그룹 padding | 4px (outer) + 6px 14px (item) | `p-1 / px-3.5 py-1.5` |
| 탭 카운트 badge | min-w 18px / radius 999px / fs 11px / fw 700 | 위 §2.2 token |

→ 위 arbitrary value 들 중 자주 등장하는 것은 token 추출.

## Step 5: 시안 픽셀 비교 체크리스트

```bash
USE_MOCK_DATA=true npm run dev
# 별도 탭에서 design/app/SIT Prototype v2.html data-stepc="4" GCP 분기 확인
```

체크 항목:
- [ ] 3-card horizontal pipeline 의 카드 외곽 / radius / connector chevron
- [ ] running 카드의 num halo (4px primary blue glow)
- [ ] done 카드의 num green / running 카드의 num blue / failed 카드의 num red
- [ ] status pill 색상 (완료=green, 진행중=blue light, 실패=red)
- [ ] 카운트 표기 `진행중 (M/N)` 형식 (Q4G-3)
- [ ] 카드 hover 시 약한 bg 변화 (line 871–872)
- [ ] 공용 DB List 헤더 typography (uppercase / tracking)
- [ ] 공용 DB List status 셀 색상 분기
- [ ] mono 셀 font-size / 색상
- [ ] Task Detail Modal 의 탭 segmented control (active = bg-white + shadow)
- [ ] Modal 의 width / padding / 헤더 sub / footer 버튼

## Step 6: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가:
- raw hex 0건:
  ```bash
  grep -rnE "#[0-9a-fA-F]{3,6}" app/components/features/process-status/install-task-pipeline/ | grep -v "fill=\"#" | grep -v "stroke=\"#"
  ```
- arbitrary value (`[…px]` / `[…rgba…]`) 사용 빈도 측정. 동일 값 ≥ 2회면 token 추출:
  ```bash
  grep -rnE "\[[0-9]+px\]|rgba\(" app/components/features/process-status/install-task-pipeline/ lib/theme.ts
  ```
- 행동 회귀 — W1a/b 의 모든 테스트 통과:
  ```bash
  npm run test -- InstallTaskCard InstallTaskPipeline Step4DbListTable InstallTaskDetailModal join-installation-resources
  ```

## Step 7: Verify

```bash
npx tsc --noEmit
npm run lint
npm run test
USE_MOCK_DATA=true npm run dev   # 시각 비교 (Step 5)
```

## Step 8: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step4-gcp/S4G-W1c-design-polish.md` @ <SHA>
- Wave: S4G-W1c
- 의존: S4G-W1a, S4G-W1b (merged)

## Changed files
- lib/theme.ts — `tagStyles.error` (없으면 추가) / `tabStyles.segmented` / `shadows.haloPrimary` / `radii.pipeline`
- app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx — token 교체
- app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx — connector 정합 + token
- app/components/features/process-status/install-task-pipeline/Step4DbListTable.tsx — tag/table token
- app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal.tsx — tab token / modal token

## Manual verification
- [ ] 시안 1726–1789 + 2328–2360 픽셀 비교 — 스크린샷 첨부 (Pipeline / DB Table / Modal 3장)
- [ ] raw hex 0건
- [ ] 기존 테스트 모두 그대로 통과 (행동 변경 없음)

## Deferred
- Azure / AWS Step 4 분기 design polish — 각 Provider plan 내부.
```

## ⛔ 금지

- 행동 변경.
- 카피 변경.
- 컴포넌트 트리 변경.
- 신규 컴포넌트 추가 (W1a/b 가 만든 것 외).
- raw hex 도입.
- 다른 Step / 다른 Provider token 정리 — 본 wave 는 Step 4 GCP 한정.
