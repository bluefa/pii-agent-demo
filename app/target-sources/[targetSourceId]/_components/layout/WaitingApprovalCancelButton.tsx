'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { cancelApprovalRequest } from '@/app/lib/api';
import { idcStyles } from '@/lib/theme';

interface WaitingApprovalCancelButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

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

      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title="연동 대상을 다시 선택할까요?"
        description={
          <>
            현재 승인 요청은 취소되고, 1단계 · 연동 대상 DB 선택으로 되돌아갑니다.
            <br />
            되돌아간 뒤에는 DB 선택부터 다시 진행해야 해요.
          </>
        }
        note="관리자에게 전달된 요청 내용은 보존되지 않으며, 취소 즉시 처리됩니다."
        confirmLabel="요청 취소"
        confirmVariant="danger"
        isPending={loading}
      />
    </>
  );
};
