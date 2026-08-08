'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { cn, primaryColors, serviceSidebarStyles } from '@/lib/theme';

/**
 * The code under the name — 12px primary, no plate. It is the identifier, so it is
 * quieter than the name and coloured rather than boxed: with no card left to sit in,
 * a grey plate would be the only enclosed thing in the dialog. #0064FF holds 4.92:1
 * on white (primaryColors.text), which is why the tint variant is not needed here.
 */
const destCode = 'font-mono text-[12px] font-medium leading-5';

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
    // The destination is not in this sentence — it stands under it, so the sentence only
    // has to say what the button does.
    description="아래 서비스의 인프라 목록으로 이동합니다."
    confirmLabel="이동하기"
  >
    {/*
      Name over code, both unenclosed: no card, no plate, no rule. The dialog is four
      lines long, and a bordered box around two of them made the destination read as an
      attachment to the question rather than as the answer to it. Size and colour carry
      the hierarchy instead — 14px ink over 12px primary.
    */}
    <div className="flex flex-col gap-0.5">
      {/* line-clamp-3 mirrors ServiceRow: the cap sits past any real name — 50-character
          names wrap to two lines here — and the tooltip holds whatever it would cut. */}
      <span
        className={cn('line-clamp-3 break-words', serviceSidebarStyles.rowName)}
        title={serviceName || undefined}
      >
        {serviceName || serviceCode}
      </span>
      {/* Same rule as the rail row: with no name the code IS the name line, so there is
          nothing left to repeat under it. */}
      {serviceName && (
        <span className={cn(destCode, primaryColors.text)}>{serviceCode}</span>
      )}
    </div>
  </ConfirmStepModal>
);
