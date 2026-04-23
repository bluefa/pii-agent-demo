# Phase 3 — `ProcessStatusCard` confirmed-integration 호출 제거

## Context

- 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §2.6 / §2.7 / §4.4.4
- `ProcessStatusCard` 가 step 2 (`WAITING_APPROVAL`) / step 3 (`APPLYING_APPROVED`) 에서 `getConfirmedIntegration` 을 호출. 신규 정책 위반.
- `ConfirmedIntegrationCollapse` 도 step 2/3 에서 사용자 액션 시 `getConfirmedIntegration` 호출 — 함께 정리.

## Goal

- `ProcessStatusCard.tsx:88-111` 의 `getConfirmedIntegration` useEffect 제거.
- `hasConfirmedIntegration` state 와 `shouldShowConfirmedIntegration` 파생값 제거.
- `ApprovalWaitingCard` / `ApprovalApplyingBanner` 에서 `hasConfirmedIntegration` prop 및 관련 분기 제거 (변경요청 배너 제거).
- `ConfirmedIntegrationCollapse` 사용처 제거 (필요 시 컴포넌트 자체도 삭제).

⚠ UX 영향: "변경요청 진행 중 — 이전 확정된 연동 정보 보기" 토글이 사라짐. 사용자가 명시적으로 "이번 정책 한정으로 step 2/3 에서 리소스 호출 없음" 으로 결정.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/ProcessStatusCard.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/components/features/process-status/ApprovalWaitingCard.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/components/features/process-status/ApprovalApplyingBanner.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/components/features/process-status/ConfirmedIntegrationCollapse.tsx ] || { echo "✗ source missing"; exit 1; }
```

병렬 가능: Phase 1 과 동시 진행 가능 (파일 overlap 없음).

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic process-status-confirmed-cleanup --prefix refactor
cd /Users/study/pii-agent-demo-process-status-confirmed-cleanup
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §2.6, §2.7
2. `app/components/features/ProcessStatusCard.tsx:75-111` (`hasConfirmedIntegration` state + useEffect)
3. `app/components/features/ProcessStatusCard.tsx:225-238` (ApprovalWaitingCard / ApprovalApplyingBanner 호출부)
4. `app/components/features/process-status/ApprovalWaitingCard.tsx` 전체
5. `app/components/features/process-status/ApprovalApplyingBanner.tsx` 전체
6. `app/components/features/process-status/ConfirmedIntegrationCollapse.tsx` 전체
7. `grep -rn "ConfirmedIntegrationCollapse\|hasConfirmedIntegration\|shouldShowConfirmedIntegration" app/` — 잔존 사용처

## Step 3 — Implementation

### 3-1. `ProcessStatusCard` 정리

`app/components/features/ProcessStatusCard.tsx`:

삭제:
- `useState` `hasConfirmedIntegration` (line 76)
- `shouldShowConfirmedIntegration` 파생 (line 77-79)
- `getConfirmedIntegration` useEffect (line 88-111)
- `import { getConfirmedIntegration ... }` 에서 `getConfirmedIntegration` 제거 (필요 시 다른 함수만 남김)

수정:
- `<ApprovalWaitingCard ... hasConfirmedIntegration={shouldShowConfirmedIntegration}>` → `hasConfirmedIntegration` prop 제거
- `<ApprovalApplyingBanner ... hasConfirmedIntegration={shouldShowConfirmedIntegration}>` → 동일 제거

### 3-2. `ApprovalWaitingCard` 정리

`app/components/features/process-status/ApprovalWaitingCard.tsx`:

- `hasConfirmedIntegration?: boolean` prop 제거
- `hasConfirmedIntegration && (<ConfirmedIntegrationCollapse ... />)` 분기 제거
- `import { ConfirmedIntegrationCollapse }` 제거

### 3-3. `ApprovalApplyingBanner` 정리

동일하게 prop 및 collapse 사용 제거.

### 3-4. `ConfirmedIntegrationCollapse` — 사용처 0 인지 확인

```bash
grep -rn "ConfirmedIntegrationCollapse" /Users/study/pii-agent-demo --include="*.ts" --include="*.tsx" | grep -v ".test."
```

3-2/3-3 후 사용처 0 이면 컴포넌트 파일 자체도 삭제:
- `app/components/features/process-status/ConfirmedIntegrationCollapse.tsx`
- 인덱스 export 가 있으면 `app/components/features/process-status/index.ts` 등에서 제거

다른 곳에서 여전히 쓴다면 그 사용처는 spec 외 — Deferred 에 기록.

### 3-5. ProcessStatusCard 의 다른 confirmed-integration 의존 검사

```bash
grep -n "confirmed\|Confirmed" /Users/study/pii-agent-demo/app/components/features/ProcessStatusCard.tsx
```

기대: 검색 결과 0 (또는 주석/원격 도메인 단어만).

## Step 4 — Do NOT touch

- `ResourceTransitionPanel.tsx` 의 `getConfirmedIntegration` useEffect → Phase 4 (또는 별도 wave 에서 approved-integration 으로 교체)
- `IntegrationTargetInfoCard` (Phase 2) → 별도 PR 에서 도입
- Provider 페이지 step 분기 → Phase 2 / 4
- `Project.resources` 필드 → Phase 4
- Mock confirmed-integration → Phase 1
- IDC `IdcProcessStatusCard` 는 별도 (이 파일은 별개의 컴포넌트, `confirmed-integration` 호출 안 함; 검증 필요)

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/features/ProcessStatusCard.tsx \
  app/components/features/process-status/ApprovalWaitingCard.tsx \
  app/components/features/process-status/ApprovalApplyingBanner.tsx
npm run build

# 사용처 0 검증
grep -rn "ConfirmedIntegrationCollapse\|hasConfirmedIntegration\|shouldShowConfirmedIntegration" app/ lib/ \
  --include="*.ts" --include="*.tsx" | grep -v ".test."
# → 기대: 0 hit (혹은 무관한 hit 만)
```

수동:
1. `bash scripts/dev.sh /Users/study/pii-agent-demo-process-status-confirmed-cleanup`
2. step 2 (WAITING_APPROVAL) TS 진입 → DevTools Network → `/confirmed-integration` 호출 0 회 확인
3. step 3 (APPLYING_APPROVED) TS 진입 → DevTools Network → `/confirmed-integration` 호출 0 회 확인
4. (참고) step 3 의 `ResourceTransitionPanel` 은 여전히 confirmed-integration 호출 — Phase 4 에서 approved-integration 으로 교체 예정. 이 단계에서는 그대로 유지.

## Step 6 — Commit / push / PR

```
refactor(process-status): step 2/3 confirmed-integration 호출 제거 (process-status-confirmed-cleanup)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §2.6, §2.7.

- ProcessStatusCard: hasConfirmedIntegration state + useEffect 제거
- ApprovalWaitingCard / ApprovalApplyingBanner: hasConfirmedIntegration prop 제거
- ConfirmedIntegrationCollapse: 사용처 0 → (조건부) 파일 삭제

UX 영향: step 2/3 의 "이전 확정 연동 정보 보기" 토글 제거.
신규 정책: step 2 = 리소스 호출 없음, step 3 = approved-integration (Phase 4 에서 교체).
```

## Step 7 — Self-review

`/sit-recurring-checks`, `/simplify`, `/vercel-react-best-practices` 순차.

## Return (under 200 words)

1. PR URL
2. tsc / lint / build 결과
3. ConfirmedIntegrationCollapse 파일 삭제 여부 + 잔존 사용처
4. step 2/3 진입 시 confirmed-integration 호출 0 확인 (네트워크 탭)
5. Spec 대비 deviation
