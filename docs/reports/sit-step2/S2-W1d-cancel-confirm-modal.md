# S2-W1d — Cancel Confirm Modal

> **Recommended model**: Sonnet 4.6
> **Estimated LOC**: ~220 (~150 component + ~70 tests)
> **Branch prefix**: `feat/sit-step2-w1d-cancel-modal`
> **Depends on**: S2-W1b (merged), S2-W1c (merged)

## Context

Step 2 의 "연동 대상 승인 요청 취소" 버튼을 시안 `confirmStepModal` (line 2300–2326) 패턴의 confirm modal 로 감싸는 작업.

본 모달은 **Step 2 만이 아니라 Step 6/7 의 "되돌아가기" UX 에도 재사용** 가능한 구조로 만든다. 단, 본 wave 에서는 Step 2 의 cancel 케이스만 wiring.

작업 범위:

1. **`ConfirmStepModal`** 재사용 컴포넌트 신규 생성 (Step 2 외에도 쓸 수 있는 시그니처).
2. **Step 2 cancel** 시나리오 wiring — 기존 `ApprovalWaitingCard` 의 cancel 버튼을 새 모달로 교체.
3. 기존 `ApprovalWaitingCard.tsx` 의 dead code 제거 (또는 W1c 의 `WaitingApprovalCard` 의 cancelSlot 으로 통합).

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.tsx ] || { echo "✗ S2-W1c 미머지"; exit 1; }
[ -f app/components/features/process-status/CancelApprovalModal.tsx ] || echo "ⓘ 기존 CancelApprovalModal 존재 — 본 wave 에서 통합 또는 제거 결정"
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 2300–2326 — `confirmStepModal` 시안 (단일 source of truth)
2. `design/app/SIT Prototype v2.html` line 1601–1607 — Step 2 cancel 버튼 위치/스타일
3. `design/app/SIT Prototype v2.html` line 263–264 — `.btn.danger-outline` 스타일
4. `app/components/features/process-status/ApprovalWaitingCard.tsx` — 기존 cancel 버튼 (제거 대상)
5. `app/components/features/process-status/CancelApprovalModal.tsx` — 기존 모달 (있으면 통합 / 없으면 신규)
6. `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/cancel/route.ts` — 호출 endpoint
7. `app/lib/api/index.ts` — `cancelApprovalRequest` helper
8. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx` (W1c 결과) — `cancelSlot` 위치
9. `docs/reports/sit-step2/00-README.md` §7 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1d-cancel-modal --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1d-cancel-modal
```

## Step 2: `ConfirmStepModal` 컴포넌트 신규

### 위치: `app/components/ui/ConfirmStepModal.tsx` (~120 LOC)

#### 2.1. Props 시그니처 (Step 6/7 재사용 가능 구조)

```ts
interface ConfirmStepModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;                  // ex) "연동 대상 승인 요청을 취소할까요?"
  description: ReactNode;         // 본문 (line break 포함 가능)
  note?: ReactNode;               // warning bg note (옵션)
  confirmLabel: string;           // ex) "요청 취소"
  cancelLabel?: string;           // default: "머무르기"
  confirmVariant?: 'danger' | 'warn';   // 시안: cancel 은 danger / 되돌아가기 는 warn
  isPending?: boolean;            // submit 중 disable
  iconVariant?: 'warn' | 'danger';      // 좌상단 아이콘 컨테이너 색상
}
```

#### 2.2. 시안 정합 (line 2300–2326)

```
┌────────────────────────────────────┐  width: 440px (시안 line 2302)
│ [⚠] {title}                        │  iconCircle 38×38, bg #FEF3C7, color #B45309
│     {description}                  │  modal-sub: 13px / color #6B7280 / line-height 1.55
│                                    │
│ ┌──────────────────────────────┐   │  note: bg #FFFBEB / border #FCD34D / color #92400E
│ │ {note}                        │   │       padding 10px 12px / radius 8px / fontSize 12px
│ └──────────────────────────────┘   │
│                                    │
│            [Cancel]  [Confirm]      │  modal-footer 표준
└────────────────────────────────────┘
```

#### 2.3. 시각 토큰 (theme.ts 추가 대상 — W1f 와 동기화)

| 시안 | 클래스 (제안) |
|---|---|
| Modal 외곽 | `bg-white rounded-xl shadow-xl w-[440px]` |
| Backdrop | `fixed inset-0 bg-black/50 z-50` |
| iconCircle (warn) | `w-[38px] h-[38px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center` |
| iconCircle (danger) | `w-[38px] h-[38px] rounded-full bg-red-100 text-red-700 ...` |
| Title | `text-[16px] font-semibold` |
| Description | `text-[13px] text-gray-500 leading-[1.55]` |
| Note | `bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-2.5 text-[12px] leading-[1.55]` |
| Footer button group | `flex justify-end gap-2 px-7 pt-4 pb-7` |
| Cancel btn | `btn outline` (theme.ts buttonStyles.outline) |
| Confirm btn (danger) | `btn dangerOutline` (theme.ts buttonStyles.dangerOutline 신규 — W1f 추가) |

⛔ raw hex 직접 사용 금지. 본 wave 에서 임시로 Tailwind class 사용 가능. 토큰 정리는 W1f 에서.

#### 2.4. 접근성

- `role="dialog"` `aria-modal="true"` `aria-labelledby` `aria-describedby`
- ESC 키 → onClose
- Backdrop click → onClose
- Confirm 버튼 클릭 후 isPending 동안 disable
- Focus trap — 첫 진입 시 cancel 버튼 (덜 위험한 액션) 에 포커스
- Tab/Shift+Tab 으로 두 버튼 순환

## Step 3: Step 2 cancel 시나리오 wiring

### 3.1. Cancel 버튼 컴포넌트 — `WaitingApprovalCancelButton`

위치: `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton.tsx` (~60 LOC)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { cancelApprovalRequest } from '@/app/lib/api';
import { TrashIcon } from '@/app/components/ui/icons';

interface Props {
  targetSourceId: number;
  onSuccess: () => Promise<void>;
}

export const WaitingApprovalCancelButton = ({ targetSourceId, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);

  const cancelMutation = useApiMutation({
    mutationFn: () => cancelApprovalRequest(targetSourceId),
    onSuccess: async () => {
      setOpen(false);
      await onSuccess();
    },
  });

  return (
    <>
      <button
        type="button"
        className={cn(buttonStyles.dangerOutline, 'inline-flex items-center gap-1.5')}
        onClick={() => setOpen(true)}
      >
        <TrashIcon className="w-3.5 h-3.5" />
        연동 대상 승인 요청 취소
      </button>

      <ConfirmStepModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="연동 대상 승인 요청을 취소할까요?"
        description={
          <>
            1단계 · 연동 대상 DB 선택으로 되돌아갑니다.
            <br />
            취소 후에는 다시 DB 선택부터 진행해야 해요.
          </>
        }
        note="관리자에게 전달된 요청 내용은 보존되지 않으며, 취소 즉시 처리됩니다."
        confirmLabel="요청 취소"
        confirmVariant="danger"
        iconVariant="warn"
        isPending={cancelMutation.isPending}
      />
    </>
  );
};
```

### 3.2. `WaitingApprovalCard` 의 cancelSlot 채우기

W1c 가 만든 `cancelSlot` prop 에 위 버튼을 주입:

```tsx
// WaitingApprovalStep.tsx
<WaitingApprovalCard
  targetSourceId={project.targetSourceId}
  cancelSlot={
    <WaitingApprovalCancelButton
      targetSourceId={project.targetSourceId}
      onSuccess={refreshProject}
    />
  }
/>
```

### 3.3. 기존 `ApprovalWaitingCard` 처리

다른 곳에서 사용하지 않는다면 **본 wave 에서 제거** (orphan import / file 정리).

```bash
grep -rln "ApprovalWaitingCard" app/ | grep -v __tests__
```

→ 결과가 0이면 파일 삭제 + 관련 테스트 제거.
→ 다른 사용처가 있으면 deletion 보류 (별도 PR 분리).

## Step 4: Tests

### 4.1. `ConfirmStepModal.test.tsx` (~70 LOC)

- open=true 시 모달 표시, false 시 미표시
- ESC → onClose 호출
- Backdrop 클릭 → onClose
- Modal body 클릭 → onClose 호출되지 않음
- Confirm 클릭 → onConfirm 호출
- isPending=true → confirm 버튼 disabled
- iconVariant / confirmVariant 별 클래스 적용

### 4.2. `WaitingApprovalCancelButton.test.tsx` (~50 LOC)

- 버튼 클릭 → 모달 open
- 모달 confirm → cancelApprovalRequest 호출
- 호출 성공 → onSuccess 호출 + 모달 close
- 호출 실패 → 모달 유지 + 에러 표시 (useApiMutation 의 표준 에러 핸들링 검증)

## Step 5: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices` 순차.

추가 검증:
- 시안 카피 1:1 매칭:
  ```bash
  grep -F "연동 대상 승인 요청 취소" app/integration/target-sources/'[targetSourceId]'/_components/layout/
  grep -F "1단계 · 연동 대상 DB 선택으로 되돌아갑니다" app/
  grep -F "관리자에게 전달된 요청 내용은 보존되지 않으며" app/
  ```
- ESC / focus trap a11y 동작 확인 (테스트 없으면 수동 dev smoke)

## Step 6: Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/ui/ConfirmStepModal.tsx app/integration/target-sources/
npm run test -- ConfirmStepModal WaitingApprovalCancelButton
USE_MOCK_DATA=true npm run dev   # 수동: Step 2 → 취소 버튼 → 모달 → 확인 → Step 1 회귀
```

## Step 7: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1d-cancel-confirm-modal.md` @ <SHA>
- Wave: S2-W1d
- 의존: S2-W1b, S2-W1c (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 2300–2326

## Changed files
- app/components/ui/ConfirmStepModal.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx (cancelSlot wiring)
- (조건부 삭제) app/components/features/process-status/ApprovalWaitingCard.tsx
- (조건부 삭제) app/components/features/process-status/CancelApprovalModal.tsx
- 테스트 신규

## Manual verification
- [ ] 시안 line 2300–2326 과 모달 픽셀 비교 — 스크린샷 첨부
- [ ] 카피 1:1 일치
- [ ] ESC / Backdrop click / Tab focus trap 동작
- [ ] mutation pending 동안 confirm 버튼 disabled

## Deferred to later waves
- "다시 선택하기" Primary 버튼 + reselectSlot wiring → S2-W1e (ConfirmStepModal 재사용 가능 — 또는 단순 버튼)
- danger-outline / warning note 등 디자인 토큰 정리 → S2-W1f
- ConfirmStepModal 의 Step 6/7 재사용 → 후속 wave (Step 6/7 작업 시)
```

## ⛔ 금지

- 시안 카피 변경.
- `ConfirmStepModal` 의 props 에 비표준 옵션 추가 (예: 임의의 `onCustomAction`) — Step 6/7 재사용 시 명세 합의 후 확장.
- 기존 `ApprovalWaitingCard` 를 다른 화면에서 import 하고 있는데 삭제하는 것 — grep 으로 사용처 확인 후 결정.
- `useApiMutation` 외부에서 try/catch 직접 작성 (CLAUDE.md 위반).
