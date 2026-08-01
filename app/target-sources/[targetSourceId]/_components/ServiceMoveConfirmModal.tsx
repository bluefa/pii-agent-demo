'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { primaryColors } from '@/lib/theme';

interface ServiceMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceCode: string;
  serviceName: string;
}

/**
 * Built on ConfirmStepModal so it shares the step-confirm spec exactly (480px, no
 * close X, 40px button pair, no footer hairline) — this dialog interrupts the same
 * flow as the step confirms and used to arrive in the older Modal chrome.
 */
export const ServiceMoveConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  serviceCode,
  serviceName,
}: ServiceMoveConfirmModalProps) => (
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    // The sidebar's current-service row opens this dialog too, so the title cannot claim
    // the destination is a *different* service. What is always true — and what the
    // confirm is actually for — is that the user leaves this page.
    title="서비스 인프라 목록으로 이동할까요?"
    // One emphasis, on the destination: the only thing to check is which service.
    description={
      <>
        <span className={primaryColors.text}>
          {serviceName || serviceCode}
          {serviceName && ` (${serviceCode})`}
        </span>
        의 인프라 목록으로 이동해요. 지금 보고 있는 화면에서 벗어나요.
      </>
    }
    confirmLabel="이동하기"
  />
);
