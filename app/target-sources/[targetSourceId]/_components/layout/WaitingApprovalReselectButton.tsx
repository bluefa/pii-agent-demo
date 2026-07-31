'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ArrowUpRightIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { confirmApprovalUnavailable } from '@/app/lib/api';
import { cn, idcStyles, primaryColors } from '@/lib/theme';

interface WaitingApprovalReselectButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

/**
 * Step 2, rejected sub-state — go back to Step 1 and pick targets again.
 *
 * NOT approval-requests/cancel: that endpoint cancels "the latest PENDING approval request" and
 * answers 404 (no pending request) / 409 (already processed) for a rejected one. The verdict has
 * already been made here, so this acknowledges it via approval-unavailable/confirm, which returns
 * the source to its initial state regardless of which verdict closed the request.
 */
export const WaitingApprovalReselectButton = ({
  targetSourceId,
  onSuccess,
}: WaitingApprovalReselectButtonProps) => {
  const modal = useModal();

  const { mutate, loading } = useApiMutation<void, Awaited<ReturnType<typeof confirmApprovalUnavailable>>>(
    () => confirmApprovalUnavailable(targetSourceId),
    { errorMessage: '처리에 실패했습니다. 다시 시도해주세요.' },
  );

  const handleConfirm = async () => {
    const result = await mutate();
    if (!result) return;
    modal.close();
    await onSuccess();
  };

  return (
    <>
      {/* Blue underlined action with a forward arrow, docked bottom-right inside the reason well —
          the verdict group carries its own way out instead of a loud standalone button under it. */}
      <button
        type="button"
        className={idcStyles.triggerBtn.linkPrimary}
        onClick={() => modal.open()}
      >
        연동 대상 다시 선택하기
        <ArrowUpRightIcon className="h-[13px] w-[13px]" />
      </button>

      {/* The title is the pre-flight nudge — once the user moves on, the reason leaves the
          screen, so "did you read it?" is the one question worth asking. Confirm stays blue
          (default variant): recovery step, not a destructive one. No loss banner — the request
          history stays visible in 진행 내역, so nothing worth warning about is lost. */}
      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title="반려 사유를 확인하셨나요?"
        description={
          // The payload is "you go BACK to step 1" — so the emphasis sits on 1단계 (a short
          // token, so no particle-boundary mush) in brand blue, and the sentence links the
          // 확인 button to its consequence directly. The screen name doubles as the restart
          // activity.
          <>
            {'확인을 누르면 '}
            <strong className={cn('font-semibold', primaryColors.text)}>1단계</strong>
            {'로 돌아가, 연동 대상 DB 선택부터 다시 진행해요.'}
          </>
        }
        confirmLabel="확인"
        isPending={loading}
      />
    </>
  );
};
