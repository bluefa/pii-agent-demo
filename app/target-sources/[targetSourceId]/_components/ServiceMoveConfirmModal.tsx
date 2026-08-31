'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { useLocale } from '@/app/components/LocaleProvider';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';

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
}: ServiceMoveConfirmModalProps) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].detail;

  return (
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
              title: t.moveFailedTitle,
              description: t.moveFailedDesc,
              reason: errorReason,
            }
          : null
      }
      // The sidebar's current-service row opens this dialog too, so neither line can claim
      // the destination is a *different* service.
      title={t.moveTitle}
      description={t.moveDesc}
      confirmLabel={t.moveConfirm}
    />
  );
};
