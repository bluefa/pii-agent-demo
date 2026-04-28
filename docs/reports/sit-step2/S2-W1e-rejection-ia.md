# S2-W1e — Rejection IA + system-reset CTA

> **Recommended model**: **Opus 4.7 MAX** (반려 IA 변경 + system-reset 호출 + processStatus refetch + 409 conflict edge case)
> **Estimated LOC**: ~250 (~170 component + ~80 tests)
> **Branch prefix**: `feat/sit-step2-w1e-rejection-ia`
> **Depends on**: S2-W1b (merged), S2-W1c (merged)

## Context

반려된 케이스의 IA 변경.

**현재 (변경 전)**:
- 반려 시 BFF 가 자동으로 processStatus 를 1로 회귀 (S2-W1b 에서 OFF 함)
- 사용자는 Step 1 화면에서 RejectionAlert 만 보고 다시 시작

**변경 후**:
- 반려 시 사용자는 Step 2 에 머무름 (`processStatus=2 && isRejected=true`)
- Step 2 화면 하단에:
  - `RejectionAlert` (반려 사유 + 반려 일시) — 기존 컴포넌트 재사용 + 시안 정합 폴리시
  - **`연동 대상 DB 다시 선택하기`** Primary 버튼 (신규)
- 버튼 클릭 → `POST /target-sources/{id}/approval-requests/system-reset` (S2-W1b 에서 추가)
- 응답 OK → `bff.targetSources.get` refetch → processStatus=1 자연 라우팅

본 wave 에서는:

1. `RejectionAlert` 시안 정합 폴리시 + reselectSlot 노출 구조 변경.
2. **`WaitingApprovalReselectButton`** 신규 — system-reset 호출 + 에러 처리.
3. `WaitingApprovalCard` 의 `reselectSlot` 채우기 (W1c 가 만든 slot).
4. 409 / 5xx 에러 edge case 처리.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.tsx ] || { echo "✗ S2-W1c 미머지"; exit 1; }
grep -q "systemResetApprovalRequest" app/lib/api/index.ts || { echo "✗ S2-W1b 미머지"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/common/RejectionAlert.tsx ] || { echo "✗ RejectionAlert 부재"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1535–1610 — Step 2 본문 (참고 — 시안에는 RejectionAlert 미정의)
2. `design/app/SIT Prototype v2.html` line 263–266 (`.btn.danger-outline`) — 참고
3. `design/app/SIT Prototype v2.html` line 197–203 (`.btn.primary`) — Primary 버튼 시안
4. `design/colors_and_type.css` — 색상 토큰
5. `app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx` 전체 (수정 대상)
6. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx` (W1c 결과)
7. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx` (W1c 결과)
8. `app/lib/api/index.ts` `systemResetApprovalRequest` (W1b 결과)
9. `app/hooks/useApiMutation.ts` — mutation pattern (CLAUDE.md `try/catch` 금지)
10. `lib/types.ts` `BaseTargetSource` line 228–251 — `isRejected` / `rejectionReason` / `rejectedAt`
11. `docs/reports/sit-step2/00-README.md` §7 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1e-rejection-ia --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1e-rejection-ia
```

## Step 2: `RejectionAlert` 시안 정합 폴리시

기존 컴포넌트 (`app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx`) 는 단독 alert 카드. 본 wave 에서는:

1. 시각 폴리시 — 시안에 RejectionAlert 가 직접 정의되어 있지 않으므로 **`StepBanner variant="error"` 패턴을 따른다**. (W1c 의 StepBanner 재사용)
2. 렌더 위치 — Step 2 카드 안의 액션 footer 위쪽 → `WaitingApprovalCard` 의 새로운 `rejectionSlot` 으로 이동.
3. 본 컴포넌트는 alert 의 메시지/사유/일시 표시까지만 담당. 버튼은 별도 컴포넌트.

### 2.1. Refactor — `RejectionAlert.tsx`

```tsx
import type { TargetSource } from '@/lib/types';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { StatusErrorIcon } from '@/app/components/ui/icons';

interface RejectionAlertProps {
  project: TargetSource;
}

export const RejectionAlert = ({ project }: RejectionAlertProps) => {
  if (!project.isRejected) return null;

  return (
    <StepBanner variant="error" icon={<StatusErrorIcon className="w-[18px] h-[18px]" />}>
      <strong className="font-semibold">승인 요청이 반려되었어요.</strong>
      {project.rejectionReason && (
        <span className="block mt-0.5">사유: {project.rejectionReason}</span>
      )}
      {project.rejectedAt && (
        <span className="block mt-0.5 text-[12px] opacity-80">
          반려일시: {new Date(project.rejectedAt).toLocaleString('ko-KR')}
        </span>
      )}
    </StepBanner>
  );
};
```

⛔ 카피 변경 시 reviewer 승인 필수. 기존 카피 `"승인 요청이 반려되었습니다"` → `"승인 요청이 반려되었어요"` 로 톤 통일 (시안 어조: `-어요` / `-해요`). 만약 reviewer 가 기존 카피 보존을 요구하면 그대로 둔다.

## Step 3: `WaitingApprovalReselectButton` 컴포넌트 신규

### 위치: `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton.tsx` (~80 LOC)

```tsx
'use client';

import { useState } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { systemResetApprovalRequest } from '@/app/lib/api';
// ArrowLeftIcon 은 본 wave 에서 신규 추가 — `app/components/ui/icons/ArrowLeftIcon.tsx`
// (현재 export: ChevronDownIcon, ClockIcon, DeleteIcon 등 — 좌향 화살표 없음)
import { ArrowLeftIcon } from '@/app/components/ui/icons';
import { buttonStyles, cn } from '@/lib/theme';

interface Props {
  targetSourceId: number;
  onSuccess: () => Promise<void>;
}

export const WaitingApprovalReselectButton = ({ targetSourceId, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);

  const resetMutation = useApiMutation({
    mutationFn: () => systemResetApprovalRequest(targetSourceId),
    onSuccess: async () => {
      setOpen(false);
      await onSuccess();   // bff.targetSources.get refetch → processStatus=1 자연 라우팅
    },
    // 409: 이미 다른 곳에서 reset 됨 — refetch 만 트리거
    onError: async (error) => {
      if (error.status === 409) {
        setOpen(false);
        await onSuccess();
        return;
      }
      // 그 외 에러는 모달 유지 + useApiMutation 의 표준 에러 표시
    },
  });

  return (
    <>
      <button
        type="button"
        className={cn(buttonStyles.primary, 'inline-flex items-center gap-1.5')}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        연동 대상 DB 다시 선택하기
      </button>

      <ConfirmStepModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => resetMutation.mutate()}
        title="연동 대상 DB 를 다시 선택할까요?"
        description={
          <>
            1단계 · 연동 대상 DB 선택으로 되돌아갑니다.
            <br />
            반려 사유를 반영하여 다시 선택해 주세요.
          </>
        }
        note="진행 중인 모든 승인 요청 상태가 초기화됩니다."
        confirmLabel="다시 선택하기"
        confirmVariant="warn"
        iconVariant="warn"
        isPending={resetMutation.isPending}
      />
    </>
  );
};
```

⛔ 카피는 **사용자에게 한 번 더 confirm 받기 위함**. 반려된 직후 별도 confirm 없이 바로 reset 하면 사용자가 실수할 수 있음. 시안에 명시는 없지만 cancel modal 과 동일한 안전 패턴 적용 — reviewer 와 합의 후 진행.

## Step 4: `WaitingApprovalCard` 에 rejectionSlot / reselectSlot wiring

### 4.1. `WaitingApprovalCard.tsx` 의 props 확장

```ts
interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;
  reselectSlot?: ReactNode;
  rejectionSlot?: ReactNode;     // ✨ 본 wave 에서 추가
}
```

### 4.2. 렌더 순서

```tsx
<Card>
  <header>...</header>
  <body>
    <StepBanner>...</StepBanner>             {/* 일반 안내 banner */}
    {rejectionSlot}                          {/* ✨ 반려 시 RejectionAlert (또 다른 banner) */}
    <WaitingApprovalTable .../>
    {(cancelSlot || reselectSlot) && (
      <footer className="flex justify-end gap-2 mt-4">
        {reselectSlot}                       {/* ✨ Primary, 왼쪽에 배치 */}
        {cancelSlot}                         {/* danger-outline, 오른쪽 */}
      </footer>
    )}
  </body>
</Card>
```

### 4.3. 액션 footer 의 조건부 분기

- `isRejected === false` → 정상 대기 상태. cancel 버튼만 표시.
- `isRejected === true` → 반려 상태. **cancel 버튼 숨기고 reselect 버튼만 표시**.
  - 이유: 반려된 요청을 cancel 하는 것은 의미가 없음. system-reset 이 명시적 reset path.

`WaitingApprovalStep.tsx` 에서 분기:

```tsx
const showCancel = !project.isRejected;
const showReselect = project.isRejected;

<WaitingApprovalCard
  targetSourceId={project.targetSourceId}
  rejectionSlot={<RejectionAlert project={project} />}
  cancelSlot={showCancel ? <WaitingApprovalCancelButton ... /> : null}
  reselectSlot={showReselect ? <WaitingApprovalReselectButton ... /> : null}
/>
```

⛔ `RejectionAlert` 가 `WaitingApprovalStep.tsx` 의 최하단에 별도로 렌더되던 기존 위치는 **제거**한다. 시안의 IA 는 카드 안 정렬.

## Step 5: 응답 후 routing 동작 확인

system-reset 응답 → `onSuccess` 의 `refreshProject` 호출 → `bff.targetSources.get` 으로 최신 project 가져옴 → `processStatus === WAITING_TARGET_CONFIRMATION (1)` 로 변경 → `CloudTargetSourceLayout` 의 `renderStep` switch 가 자동으로 Step 1 화면 (`WaitingTargetConfirmationStep`) 을 렌더.

→ **router.push 등 명시적 라우팅 불필요**. 본 IA 는 state-driven.

→ 단, dev smoke 에서 step 전환 시 깜빡임이 있다면 `useTransition` 또는 optimistic update 검토 (W1f 에서 폴리시 가능).

## Step 6: 권한 / 에러 케이스

| 케이스 | UI 동작 |
|---|---|
| 200 OK | 모달 close + refetch → Step 1 |
| 409 Conflict (이미 reset 됨) | 모달 close + refetch (자연 동기화) |
| 403 Forbidden | 모달 유지 + 에러 toast |
| 404 Not Found | 모달 유지 + 에러 toast |
| 5xx | 모달 유지 + 재시도 가능 |
| Network error | 모달 유지 + 재시도 가능 |

→ `useApiMutation` 의 표준 에러 핸들링이 4xx/5xx 를 toast 로 띄움. 추가 wiring 불필요.

## Step 7: Tests

### 7.1. `RejectionAlert.test.tsx` (~30 LOC)

- isRejected=false → null 렌더
- isRejected=true → StepBanner variant=error 렌더 + 사유/일시 표시
- rejectionReason 없으면 사유 라인 비표시
- rejectedAt 없으면 일시 라인 비표시

### 7.2. `WaitingApprovalReselectButton.test.tsx` (~50 LOC)

- 버튼 클릭 → 모달 open
- Confirm → systemResetApprovalRequest 호출
- 200 → onSuccess 호출
- 409 → onSuccess 호출 (자연 동기화)
- 403/500 → 모달 유지

### 7.3. `WaitingApprovalStep.integration.test.tsx` (~60 LOC)

- isRejected=false → cancel 버튼만 노출 / RejectionAlert 미노출
- isRejected=true → reselect 버튼만 노출 / RejectionAlert 노출 / cancel 버튼 미노출
- system-reset 응답 후 processStatus=1 mock 시 Step 1 컴포넌트로 전환

## Step 8: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가 검증:
- 카피:
  ```bash
  grep -F "연동 대상 DB 다시 선택하기" app/integration/target-sources/
  grep -F "1단계 · 연동 대상 DB 선택으로 되돌아갑니다" app/integration/target-sources/
  ```
- `RejectionAlert` 가 `WaitingApprovalStep.tsx` 최하단에 직접 렌더되던 기존 위치 제거 확인.
- 409 conflict 처리에 try/catch 직접 작성 없음 — `useApiMutation.onError` 패턴.

## Step 9: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/_components/
npm run test -- RejectionAlert WaitingApprovalReselect WaitingApprovalStep
USE_MOCK_DATA=true npm run dev
# 수동:
#   1. mock 에서 reject 트리거 → Step 2 머무름 + RejectionAlert + Primary 버튼 노출
#   2. 버튼 → confirm modal → 다시 선택 → Step 1 회귀
#   3. mock 에서 cancel 후 다른 탭에서 미리 reset 트리거 → 409 회귀 시 자연 동기화
```

## Step 10: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1e-rejection-ia.md` @ <SHA>
- Wave: S2-W1e
- 의존: S2-W1b, S2-W1c (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1535–1610 + line 197–203 (Primary 버튼)

## Changed files
- app/components/ui/icons/ArrowLeftIcon.tsx (신규 — 본 wave 에서 추가)
- app/components/ui/icons/index.ts (export 추가)
- app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx (refactor → StepBanner 패턴, 아이콘 StatusErrorIcon)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx (rejectionSlot/reselectSlot 추가)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx (분기 + slot wiring)
- 테스트 신규/수정

## Manual verification
- [ ] mock 에서 reject → Step 2 화면 머무름 (스크린샷)
- [ ] Primary "연동 대상 DB 다시 선택하기" 버튼 노출
- [ ] 버튼 클릭 → confirm modal → 확인 → Step 1 으로 자연 라우팅
- [ ] 409 / 5xx edge case 동작 확인

## Deferred to later waves
- 디자인 토큰 정리 (banner.error / Primary 버튼) → S2-W1f
- ConfirmStepModal 의 Step 6/7 재사용 → 후속 wave
```

## ⛔ 금지

- `RejectionAlert` 의 alert tone (error variant) 을 warn / info 로 바꾸지 말 것.
- `useApiMutation` 외부에서 try/catch 사용 금지.
- 반려 케이스에서 cancel 버튼을 함께 표시하는 것 — UX 결정 (reselect 만 노출).
- system-reset 호출 후 명시적 `router.push` — state-driven routing 만 사용.
- 본 wave 에서 디자인 토큰 (`theme.ts`) 신규 정의 — W1f 에서 일괄 정리. 본 wave 는 임시 Tailwind class 사용 후 W1f 가 토큰화.
