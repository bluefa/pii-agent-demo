# S3-W1c — Design Polish (Step 3 픽셀 정합)

> **Recommended model**: Sonnet 4.6 (행동 변경 없음 — token 매핑 + 클래스 교체)
> **Estimated LOC**: ~80 (대부분 클래스 변경)
> **Branch prefix**: `feat/sit-step3-w1c-design-polish`
> **Depends on**: S3-W1a, S3-W1b (모두 머지)

## Context

S3-W1a (table + card) + S3-W1b (error state) 머지 후 시안과 픽셀 정합 final pass.

**행동 / 카피 / 컴포넌트 트리 변경 절대 금지**. 변경 가능한 것:

- `lib/theme.ts` 토큰 사용 정리 (raw class → token)
- 컴포넌트 className 교체
- spacing / radius / shadow 미세 조정

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/integration/target-sources/'[targetSourceId]'/_components/approved/ApplyingApprovedTable.tsx ] || { echo "✗ S3-W1a 미머지"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/approved/ApplyingErrorAlert.tsx ] || { echo "✗ S3-W1b 미머지"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1612–1677 (Step 3) + line 1–815 (CSS 토큰)
2. S3-W1a/W1b 산출 컴포넌트들
3. `lib/theme.ts` (S2-W1f 가 추가한 토큰 — 재사용 우선)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step3-w1c-design-polish --prefix feat
```

## Step 2: 토큰 재사용 검증

S2-W1f 가 이미 추가했어야 할 토큰들이 본 wave 에 충분한지 확인:

| 시안 | 필요 토큰 | S2-W1f 가 추가했는가? |
|---|---|---|
| 카드 외곽 | `radii.card` (`rounded-xl`) | ✅ |
| 테이블 헤더 bg | `bgColors.muted` (`bg-gray-50`) | ✅ (기존) |
| 테이블 헤더 typography | `tableStyles.headerCell` | ✅ (기존) |
| `tag blue` (DB Type) | `tagStyles.info` | ✅ (S2-W1f) |
| StepBanner variant=error | `bannerStyles.error` | ✅ (S2-W1f) |
| Primary 버튼 | `buttonStyles.primary` | ✅ (기존) |
| Confirm modal | `bg/border/note` 토큰 | ✅ (S2-W1f) |
| `mono` 셀 | `font-mono text-[12px]` | inline 또는 `mono` 토큰 추출 검토 |

→ **신규 토큰 추가 거의 0건 예상**. 토큰 재사용에 그치는 것이 본 wave 의 목표.

## Step 3: 컴포넌트 클래스 정리

### 3.1. `ApplyingApprovedTable.tsx`

- "DB Type" 셀의 `<span class="font-mono text-[12px]">` → 가능하면 공용 `mono-cell` 클래스 추출 (theme.ts 에 신규 추가). 아니면 inline 유지.
- "DB Type" badge → `tagStyles.info` 사용.
- 헤더 / 행 / 셀 → `tableStyles.*` 일관 적용.

### 3.2. `ApplyingApprovedCard.tsx`

- Card 컴포넌트가 이미 `radii.card` + `shadow-sm` 사용 중인지 확인.
- 헤더 padding → `px-6 py-4`, sub-text 색상 → `textColors.tertiary`.

### 3.3. `ApplyingErrorAlert.tsx`

- StepBanner 가 토큰 사용 — 본 wave 에서 추가 변경 거의 없음.

### 3.4. `ApplyingReselectButton.tsx`

- `buttonStyles.primary` 사용 검증. inline padding/font 조정 필요 시 token 화.

## Step 4: Spacing / Padding 미세 조정

| 요소 | 시안 값 | 클래스 |
|---|---|---|
| 카드 본문 padding | 24px | `p-6` |
| 카드 헤더 padding | 16px 24px | `px-6 py-4` |
| 카드 헤더 border | 1px gray-100 | `border-b border-gray-100` |
| 테이블 헤더 padding | 12px 24px | `px-6 py-3` |
| 테이블 셀 padding | 16px 24px | `px-6 py-4` |
| Banner padding | 14px 18px | `px-[18px] py-[14px]` (이미 StepBanner 가 적용) |

## Step 5: 시안 픽셀 비교 체크리스트

```bash
USE_MOCK_DATA=true npm run dev
# 별도 탭에서 design/app/SIT Prototype v2.html 직접 열어 Step 3 (data-stepc="3") 비교
```

체크 항목:
- [ ] 카드 외곽 radius / shadow / 헤더 border
- [ ] 카드 sub-text 색상 (gray-500 ≈ var(--fg-3))
- [ ] 테이블 헤더 typography (uppercase / tracking / 색상)
- [ ] 테이블 행 hover bg
- [ ] mono 셀 font-size / 색상
- [ ] 제외 행과 선택 행의 시각 차이 **없음** (시안 그대로)
- [ ] error banner (mock 시나리오) — 색상/border/icon
- [ ] Primary 버튼 padding / hover
- [ ] confirm modal 정합 (S2-W1f 와 공유 — 회귀 검증)

## Step 6: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가:
- raw hex 0건:
  ```bash
  grep -rnE "#[0-9a-fA-F]{3,6}" app/integration/target-sources/'[targetSourceId]'/_components/approved/ | grep -v "fill=\"#" | grep -v "stroke=\"#"
  ```
- arbitrary value 사용은 theme.ts 안에서만 (또는 의도된 것):
  ```bash
  grep -nE "\[[0-9]+px\]" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  ```
- 행동 회귀 — W1a/b 의 모든 테스트 그대로 통과:
  ```bash
  npm run test -- ApplyingApproved ApplyingError ApplyingReselect
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
- Spec: `docs/reports/sit-step3/S3-W1c-design-polish.md` @ <SHA>
- Wave: S3-W1c
- 의존: S3-W1a, S3-W1b (merged)

## Changed files
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedTable.tsx — token 교체
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedCard.tsx — token 교체
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingErrorAlert.tsx — (변경 거의 없음)
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingReselectButton.tsx — token 교체
- (조건부) lib/theme.ts — `monoCell` 같은 공용 mono 셀 토큰 추출 시

## Manual verification
- [ ] 시안 line 1612–1677 와 dev 서버 화면 픽셀 비교 — 스크린샷 첨부 (정상 / SYSTEM_ERROR 2장)
- [ ] raw hex 0건
- [ ] 기존 테스트 모두 그대로 통과 (행동 변경 없음)

## Deferred
- 다른 Step 의 design polish — 각 Step wave 내부.
```

## ⛔ 금지

- 행동 변경.
- 카피 변경.
- 컴포넌트 트리 변경.
- 신규 컴포넌트 추가.
- raw hex 도입.
- 다른 Step / 다른 페이지 token 정리 — 본 wave 는 Step 3 한정.
