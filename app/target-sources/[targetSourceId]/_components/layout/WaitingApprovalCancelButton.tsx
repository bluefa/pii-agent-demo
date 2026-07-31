'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { cancelApprovalRequest } from '@/app/lib/api';
import { cn, idcStyles, primaryColors } from '@/lib/theme';

interface WaitingApprovalCancelButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

/** PENDING requests only — a rejected one uses WaitingApprovalReselectButton (cancel rejects it). */
export const WaitingApprovalCancelButton = ({
  targetSourceId,
  onSuccess,
}: WaitingApprovalCancelButtonProps) => {
  const modal = useModal();

  const { mutate, loading } = useApiMutation<void, { success: boolean }>(
    () => cancelApprovalRequest(targetSourceId),
    {
      errorMessage: '승인 요청 취소에 실패했습니다. 다시 시도해주세요.',
    },
  );

  const handleConfirm = async () => {
    const result = await mutate();
    if (!result?.success) return;
    modal.close();
    await onSuccess();
  };

  return (
    <>
      {/* A rewind, not a deletion — reuses the existing warnOutline (amber) tone shared with the IDC
          "rerun connection test" action. The modal states that the request is cancelled. */}
      <button
        type="button"
        className={idcStyles.triggerBtn.warnOutline}
        onClick={() => modal.open()}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        다시 요청하기
      </button>

      {/* Same grammar as the rejected-state reselect modal: question title, one cause→effect
          sentence with 1단계 in brand blue, blue 확인. No loss banner — the request history
          stays visible in 진행 내역, and cancelling is a rewind, not a deletion. */}
      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title="승인 요청을 취소할까요?"
        description={
          // Kept to one rendered line in the 480px dialog: '진행 중인' and the screen name are
          // dropped — the request can only be the current one, and 1단계 already names the place.
          <>
            {'확인을 누르면 승인 요청이 취소되고, '}
            <strong className={cn('font-semibold', primaryColors.text)}>1단계</strong>
            {'부터 다시 진행해요.'}
          </>
        }
        confirmLabel="확인"
        isPending={loading}
      />
    </>
  );
};
