'use client';

import { useState } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { DeleteIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { cancelApprovalRequest } from '@/app/lib/api';
import { cn, confirmModalStyles } from '@/lib/theme';

interface WaitingApprovalCancelButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

export const WaitingApprovalCancelButton = ({
  targetSourceId,
  onSuccess,
}: WaitingApprovalCancelButtonProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, loading } = useApiMutation<void, { success: boolean }>(
    () => cancelApprovalRequest(targetSourceId),
    {
      errorMessage: '승인 요청 취소에 실패했습니다. 다시 시도해주세요.',
      onSuccess: async () => {
        setOpen(false);
        await onSuccess();
      },
    },
  );

  return (
    <>
      <button
        type="button"
        className={cn(confirmModalStyles.dangerOutlineButton, 'gap-1.5 text-[13px]')}
        onClick={() => setOpen(true)}
      >
        <DeleteIcon className="w-3.5 h-3.5" />
        연동 대상 승인 요청 취소
      </button>

      <ConfirmStepModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          void mutate();
        }}
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
        isPending={loading}
      />
    </>
  );
};
