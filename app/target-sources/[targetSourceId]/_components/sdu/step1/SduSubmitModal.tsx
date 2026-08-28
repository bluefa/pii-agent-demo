'use client';

import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import { approvalFailureCopy } from '@/app/components/ui/confirm-failures';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import type { AppErrorCode } from '@/lib/errors';
import { cn, numericFeatures, primaryColors, textColors } from '@/lib/theme';

export interface SduSubmitModalProps {
  isOpen: boolean;
  targetCount: number;
  regionCount: number;
  phase: ConfirmSubmitPhase;
  pending: boolean;
  errorCode?: AppErrorCode;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * SDU 에는 승인 절차가 없다 — 제출은 관리자에게 검토를 부탁하는 일이 아니라 곧바로
 * 데이터 업로드 단계로 넘어가는 일이다. 그래서 확인 문장이 말해야 할 것은 "누가 볼지"가
 * 아니라 **무엇이 만들어지는지**(Region 곳수 = 업로드 경로 수)다.
 */
const RESULTS: Record<'success' | 'error', ConfirmStepResult> = {
  success: {
    kind: 'success',
    title: '연동 대상을 제출했어요',
    description: '잠시 후 데이터 업로드 단계로 이동해요.',
  },
  error: {
    kind: 'error',
    title: '연동 대상을 제출하지 못했어요',
    // 실패가 지운 것이 없다는 말이 먼저다 — 입력한 대상이 그대로라는 것을 모르면
    // 사용자는 다시 제출하기보다 화면을 처음부터 확인하려 든다.
    description: '입력하신 대상은 그대로 남아 있어요.',
  },
};

export const SduSubmitModal = ({
  isOpen,
  targetCount,
  regionCount,
  phase,
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: SduSubmitModalProps) => {
  const failure = approvalFailureCopy(errorCode);
  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      result={
        phase === 'success'
          ? RESULTS.success
          : phase === 'error'
            ? { ...RESULTS.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title="연동 대상을 제출할까요?"
      description={
        <>
          대상 {targetCount}건 · Region {regionCount}곳으로{' '}
          <span className={primaryColors.text}>업로드 경로 {regionCount}개가 만들어져요</span>.
          SDU는 승인 절차가 없어 제출하면 바로 데이터 업로드 단계로 넘어가요.
        </>
      }
      confirmLabel="제출하기"
      size="sm"
    >
      <p className={cn('text-[14px] font-medium', numericFeatures.tabular, textColors.tertiary)}>
        제출한 뒤에도 2단계에서 연동 대상을 고치러 이 화면으로 돌아올 수 있어요.
      </p>
    </ConfirmStepModal>
  );
};
