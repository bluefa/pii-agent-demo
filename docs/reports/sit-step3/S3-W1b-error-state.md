# S3-W1b — SYSTEM_ERROR / UNAVAILABLE Alert + Step 1 회귀 버튼

> **Recommended model**: Sonnet 4.6 (S2-W1e 패턴 재사용 — 설계 결정 거의 없음)
> **Estimated LOC**: ~150 (~80 component + ~70 tests)
> **Branch prefix**: `feat/sit-step3-w1b-error-state`
> **Depends on**: S2-W1b (system-reset endpoint), S2-W1c (StepBanner), S2-W1e (Reselect 패턴), S3-W1a (errorSlot/reselectSlot 노출)

## Context

Step 3 에서 ApprovedIntegration 반영 중 BFF 가 SYSTEM_ERROR(= UNAVAILABLE) 상태로 빠지면:

- **Step 2 의 RejectionAlert 와 동일 위치 / 동일 패턴**으로 error banner 노출
- **Primary "연동 대상 DB 다시 선택하기" 버튼** 노출
- 버튼 클릭 → confirm modal → `system-reset` 호출 → ProcessStatus 1 자연 라우팅

S2-W1e 가 만든 `WaitingApprovalReselectButton` 의 system-reset 호출 / 409 처리 / refetch 로직을 거의 그대로 재사용한다. 본 wave 의 핵심은:

1. **`ApplyingErrorAlert`** 신규 — error banner (StepBanner variant=error)
2. **`ApplyingReselectButton`** 신규 — Primary 버튼 + confirm modal
3. **상태 감지** — process-status 응답에서 SYSTEM_ERROR / UNAVAILABLE 판별
4. S3-W1a 의 errorSlot / reselectSlot 채움

⚠️ 기회가 된다면 S2-W1e 의 `WaitingApprovalReselectButton` 과 본 wave 의 `ApplyingReselectButton` 을 **shared `SystemResetButton`** 으로 통합 리팩토링. 단, 본 wave 의 책임은 Step 3 한정 — 통합은 별도 issue 권장.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/integration/target-sources/'[targetSourceId]'/_components/approved/ApplyingApprovedCard.tsx ] || { echo "✗ S3-W1a 미머지"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalReselectButton.tsx ] || { echo "✗ S2-W1e 미머지"; exit 1; }
[ -f app/components/ui/ConfirmStepModal.tsx ] || { echo "✗ S2-W1d 미머지"; exit 1; }
[ -f app/components/ui/StepBanner.tsx ] || { echo "✗ S2-W1c 미머지"; exit 1; }
grep -q "systemResetApprovalRequest" app/lib/api/index.ts || { echo "✗ S2-W1b 미머지"; exit 1; }
```

## Required reading

1. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton.tsx` (S2-W1e — 패턴 reference)
2. `app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedCard.tsx` (S3-W1a — slot 노출 위치)
3. `app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx` (수정 대상)
4. `app/components/ui/StepBanner.tsx` (재사용)
5. `app/components/ui/ConfirmStepModal.tsx` (재사용)
6. `docs/bff-api/tag-guides/approval-requests.md` line 326–395 (system-reset)
7. `docs/swagger/confirm.yaml` `ProcessStatusResponse` (line 1504–1539) — `last_approval_result` enum 의 SYSTEM_ERROR / UNAVAILABLE 식별
8. `app/lib/api/index.ts` `systemResetApprovalRequest` / process-status 조회 helper
9. `lib/types.ts` `LastApprovalResult` enum
10. `docs/reports/sit-step3/00-README.md` §8.2 (SYSTEM_ERROR 카피)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step3-w1b-error-state --prefix feat
cd /Users/study/pii-agent-demo-sit-step3-w1b-error-state
```

## Step 2: 상태 감지 헬퍼

### 위치: `app/integration/target-sources/[targetSourceId]/_components/approved/applying-error.ts` (~30 LOC)

```ts
import type { ProcessStatusResponse } from '@/lib/types';

export interface ApplyingErrorState {
  hasError: boolean;
  reason?: string;          // 에러 사유 (있으면 banner 에 노출)
}

export const detectApplyingError = (
  status: ProcessStatusResponse | undefined,
): ApplyingErrorState => {
  if (!status) return { hasError: false };

  const result = status.status_inputs?.last_approval_result;
  if (result === 'SYSTEM_ERROR' || result === 'UNAVAILABLE') {
    return {
      hasError: true,
      reason: status.status_inputs?.last_rejection_reason ?? undefined,
    };
  }
  return { hasError: false };
};
```

⛔ SYSTEM_ERROR 와 UNAVAILABLE 두 enum 값을 동일하게 처리. 추후 BFF 가 두 값을 의미적으로 분리하면 본 함수만 수정.

## Step 3: `ApplyingErrorAlert` 컴포넌트

### 위치: `app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingErrorAlert.tsx` (~50 LOC)

```tsx
import { StepBanner } from '@/app/components/ui/StepBanner';
import { AlertTriangleIcon } from '@/app/components/ui/icons';

interface ApplyingErrorAlertProps {
  reason?: string;
}

export const ApplyingErrorAlert = ({ reason }: ApplyingErrorAlertProps) => (
  <StepBanner variant="error" icon={<AlertTriangleIcon className="w-[18px] h-[18px]" />}>
    <strong className="font-semibold">인프라 반영 중 오류가 발생했어요.</strong>
    {' '}다시 선택 후 재시도해 주세요.
    {reason && (
      <span className="block mt-0.5 text-[12px] opacity-80">사유: {reason}</span>
    )}
  </StepBanner>
);
```

⛔ 카피는 00-README §8.2 합의안. reviewer 가 다른 카피 요구 시 그쪽 우선.

## Step 4: `ApplyingReselectButton` 컴포넌트

### 위치: `app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingReselectButton.tsx` (~70 LOC)

S2-W1e 의 `WaitingApprovalReselectButton` 과 거의 동일. 차이는 confirm modal 의 본문 카피만:

```tsx
'use client';

import { useState } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { systemResetApprovalRequest } from '@/app/lib/api';
import { ArrowLeftIcon } from '@/app/components/ui/icons';
import { buttonStyles, cn } from '@/lib/theme';

interface Props {
  targetSourceId: number;
  onSuccess: () => Promise<void>;
}

export const ApplyingReselectButton = ({ targetSourceId, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);

  const resetMutation = useApiMutation({
    mutationFn: () => systemResetApprovalRequest(targetSourceId),
    onSuccess: async () => {
      setOpen(false);
      await onSuccess();
    },
    onError: async (error) => {
      if (error.status === 409) {
        setOpen(false);
        await onSuccess();
        return;
      }
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
            반영 중이던 모든 상태가 초기화돼요.
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

⚠️ 본 컴포넌트는 S2-W1e 의 `WaitingApprovalReselectButton` 과 90% 중복이다. 본 wave 에서는 별도 파일로 두고, **다음 cleanup wave (또는 별도 issue)** 에서 `SystemResetButton` 으로 통합 리팩토링 권장. 통합 명세 합의 전 본 wave 에서 추출하지 말 것 (props 추상화 방향 결정 필요).

## Step 5: `ApplyingApprovedStep.tsx` wiring

```tsx
import { useApiQuery } from '@/app/hooks/useApiQuery';
import { detectApplyingError } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/applying-error';
import { ApplyingErrorAlert } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingErrorAlert';
import { ApplyingReselectButton } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingReselectButton';
import { getProcessStatus } from '@/app/lib/api';

export const ApplyingApprovedStep = ({ project, identity, providerLabel, action, onProjectUpdate }: Props) => {
  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  const { data: statusData } = useApiQuery({
    queryKey: ['process-status', project.targetSourceId],
    queryFn: ({ signal }) => getProcessStatus(project.targetSourceId, { signal }),
    refetchInterval: 5000,
  });

  const errorState = detectApplyingError(statusData);

  return (
    <>
      <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />

      <ApplyingApprovedCard
        targetSourceId={project.targetSourceId}
        errorSlot={errorState.hasError ? <ApplyingErrorAlert reason={errorState.reason} /> : null}
        reselectSlot={
          errorState.hasError
            ? <ApplyingReselectButton targetSourceId={project.targetSourceId} onSuccess={refreshProject} />
            : null
        }
      />
    </>
  );
};
```

⛔ `useApiQuery` 의 polling interval 은 기존 ProcessStatusCard 가 처리하는 폴링과 충돌하지 않게 조정. 기존 폴링 hook 이 별도라면 그 응답을 직접 prop drill 로 받는 것도 가능 — 본 wave 에서는 단순 별도 query 로 두되, 중복 검토는 self-audit 에서.

## Step 6: Mock 시나리오 추가

`lib/bff/mock/confirm.ts` 또는 mock seed 에 SYSTEM_ERROR / UNAVAILABLE 시나리오 추가:

```ts
// 특정 mock target-source ID (예: 9001) 를 SYSTEM_ERROR 로 시드
{
  targetSourceId: 9001,
  processStatus: ProcessStatus.APPLYING_APPROVED,
  lastApprovalResult: 'UNAVAILABLE',
  lastRejectionReason: 'Mock 환경: Subnet 생성 실패',
  // ... 나머지
}
```

→ dev 에서 `?targetSourceId=9001` 로 진입하여 error 화면 확인.

## Step 7: Tests

### 7.1. `applying-error.test.ts` (~30 LOC)

- last_approval_result=SYSTEM_ERROR → hasError=true
- last_approval_result=UNAVAILABLE → hasError=true
- last_approval_result=APPROVED → hasError=false
- status undefined → hasError=false
- reason 전달 검증

### 7.2. `ApplyingErrorAlert.test.tsx` (~30 LOC)

- StepBanner variant=error 사용 검증
- 카피 1:1
- reason 있을 때 / 없을 때 표시 분기

### 7.3. `ApplyingReselectButton.test.tsx` (~50 LOC)

S2-W1e 의 테스트와 동일 시나리오 (mutation 호출 / 200 / 409 / 5xx)

### 7.4. `ApplyingApprovedStep.error.integration.test.tsx` (~50 LOC)

- mock SYSTEM_ERROR 시나리오 → error banner + reselect button 노출
- 정상 시나리오 → error banner / reselect button 미노출

## Step 8: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가:
- 카피 매칭:
  ```bash
  grep -F "인프라 반영 중 오류가 발생했어요" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  grep -F "연동 대상 DB 다시 선택하기" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  ```
- S2-W1e 와의 중복 인지 + 추후 통합 가능성 명시 (PR description "Deferred" 항목)

## Step 9: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/_components/approved/
npm run test -- ApplyingError ApplyingReselect applying-error
USE_MOCK_DATA=true npm run dev   # 수동: mock SYSTEM_ERROR 시나리오 진입
```

## Step 10: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step3/S3-W1b-error-state.md` @ <SHA>
- Wave: S3-W1b
- 의존: S2-W1b/c/d/e, S3-W1a (merged)

## Changed files
- app/integration/target-sources/[targetSourceId]/_components/approved/applying-error.ts (신규)
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingErrorAlert.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingReselectButton.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx (errorSlot/reselectSlot wiring)
- lib/bff/mock/confirm.ts (UNAVAILABLE 시나리오 시드)
- 테스트 신규/수정

## Manual verification
- [ ] mock 9001 진입 → error banner + reselect button 노출 (스크린샷)
- [ ] reselect 클릭 → confirm modal → 확인 → Step 1 회귀
- [ ] 정상 mock 진입 → error 화면 미노출

## Deferred
- S2-W1e 의 WaitingApprovalReselectButton 와 본 ApplyingReselectButton 통합 (SystemResetButton) — 별도 cleanup wave
- 디자인 토큰 정리 → S3-W1c
```

## ⛔ 금지

- system-reset 외 새 endpoint 호출.
- `useApiMutation` 외부 try/catch.
- 시안 카피 변경.
- S2-W1e 의 `WaitingApprovalReselectButton` 본 wave 에서 통합 리팩토링 — 별도 issue.
