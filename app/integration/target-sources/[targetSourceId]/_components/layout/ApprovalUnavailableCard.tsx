'use client';

import { useCallback } from 'react';
import { confirmApprovalUnavailable } from '@/app/lib/api';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { cardStyles, cn, confirmModalStyles, statusColors, textColors } from '@/lib/theme';

interface ApprovalUnavailableCardProps {
  targetSourceId: number;
  reason: string;
  onReselected?: () => Promise<void> | void;
}

/**
 * Step 2, 연동 불가 sub-state. The admin judged the requested targets un-integratable
 * (approval-requests/latest → result.status === 'UNAVAILABLE'). Surfaces the reason
 * and the single "뒤로 이동" recovery action: confirmApprovalUnavailable acknowledges
 * the verdict and returns the source to its initial state (Step 1) to re-select targets.
 */
export const ApprovalUnavailableCard = ({
  targetSourceId,
  reason,
  onReselected,
}: ApprovalUnavailableCardProps) => {
  const modal = useModal();
  const { mutate, loading } = useApiMutation<void, Awaited<ReturnType<typeof confirmApprovalUnavailable>>>(
    () => confirmApprovalUnavailable(targetSourceId),
    { errorMessage: '처리에 실패했습니다. 다시 시도해주세요.' },
  );

  const handleConfirm = useCallback(async () => {
    const result = await mutate();
    if (!result) return;
    modal.close();
    await onReselected?.();
  }, [modal, mutate, onReselected]);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn(cardStyles.cardTitle)}>연동 대상 연동 불가</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            관리자가 요청하신 연동 대상을 연동할 수 없다고 판정했어요.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            statusColors.error.bg,
            statusColors.error.textDark,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.error.dot)} />
          연동 불가
        </span>
      </div>

      <div className="p-6">
        <StepBanner variant="error" icon={<StatusWarningIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">선택하신 연동 대상은 연동할 수 없습니다.</strong>
          {reason ? <>{' · '}사유: {reason}</> : null}
        </StepBanner>

        <p className={cn('mt-4 text-sm', textColors.secondary)}>
          연동 대상 DB 선택 단계로 돌아가 대상을 다시 구성해주세요.
        </p>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className={cn(confirmModalStyles.outlineButton, 'gap-1.5 text-[13px]')}
            onClick={() => modal.open()}
          >
            뒤로 이동
          </button>
        </div>
      </div>

      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title="연동 대상 DB 선택으로 되돌아갈까요?"
        description={
          <>
            1단계 · 연동 대상 DB 선택으로 되돌아갑니다.
            <br />
            기존 선택은 초기화되며, 다시 DB 선택부터 진행해야 해요.
          </>
        }
        note="연동 불가로 판정된 요청 내용은 보존되지 않습니다."
        confirmLabel="뒤로 이동"
        confirmVariant="danger"
        isPending={loading}
      />
    </section>
  );
};
