'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';

interface ServiceMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 다시 요청하기 on the failure frame — the same move, attempted again. */
  onRetry?: () => void;
  /** The move is out and the deadline has not passed yet. */
  isPending?: boolean;
  /** Why the move gave up. Present = the dialog shows its failure frame. */
  errorReason?: string | null;
}

/**
 * Built on ConfirmStepModal so it shares the step-confirm spec exactly (480px, no
 * close X, 40px button pair, no footer hairline) — this dialog interrupts the same
 * flow as the step confirms and used to arrive in the older Modal chrome.
 *
 * It names no service. The row that opened it is still on screen behind the dialog,
 * so repeating the name and code here only re-answered a question the click already
 * settled; what the confirm is actually for is that the user leaves this page.
 */
export const ServiceMoveConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  onRetry,
  isPending = false,
  errorReason = null,
}: ServiceMoveConfirmModalProps) => (
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    onRetry={onRetry}
    isPending={isPending}
    // The failure says what did not happen and how long it waited. It does not tell the
    // user to try later or to ask someone — 다시 요청하기 is right there, and the wait is
    // the only fact this dialog actually knows.
    result={
      errorReason
        ? {
            kind: 'error',
            title: '이동하지 못했어요',
            description: '서비스 인프라 목록을 여는 데 실패했습니다.',
            reason: errorReason,
          }
        : null
    }
    // The sidebar's current-service row opens this dialog too, so neither line can claim
    // the destination is a *different* service.
    title="서비스 인프라 목록으로 이동할까요?"
    description="선택한 서비스의 인프라 목록으로 이동합니다."
    confirmLabel="이동하기"
  />
);
