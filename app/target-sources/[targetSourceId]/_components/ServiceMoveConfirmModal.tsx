'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';

interface ServiceMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
}: ServiceMoveConfirmModalProps) => (
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    // The sidebar's current-service row opens this dialog too, so neither line can claim
    // the destination is a *different* service.
    title="서비스 인프라 목록으로 이동할까요?"
    description="선택한 서비스의 인프라 목록으로 이동합니다."
    confirmLabel="이동하기"
  />
);
