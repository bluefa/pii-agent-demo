'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { cn, serviceSidebarStyles } from '@/lib/theme';

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
    // The destination moved out of the sentence and into the block below: name and code
    // ran together in one line as `이름 (코드)`, which is an apposition, not a hierarchy.
    description="아래 서비스의 인프라 목록으로 이동해요. 지금 보고 있는 화면에서 벗어나요."
    confirmLabel="이동하기"
  >
    {/*
      The sidebar row the user just clicked, repeated verbatim — same tile, same name
      tier, same code tag — so confirming is recognition rather than comparison.
      Bordered instead of tinted: the block sits on the modal's white body, where a
      fill light enough to stay quiet would be invisible (the rail's search field
      makes the same call).

      Name over code, not name-then-code on one line: service names run to ~50
      characters, which wraps to two lines at this width, and a right-hand code
      column would then float beside the wrong line. Stacked, the name owns the full
      width and the code stays under it. line-clamp-3 mirrors ServiceRow — the cap is
      past any real name — and the tooltip holds whatever it cuts. No tooltip on the
      code-only line: it is short enough that nothing can be cut off it.
    */}
    {/* items-start, not the row's items-center: a 50-character name is two lines and a
        centered tile would drift down beside the second one. Top-aligned, the tile always
        anchors the name's first line. */}
    <div className="flex items-start gap-2.5 rounded-[12px] border border-[#EBEEF2] px-3.5 py-3">
      <span
        className={cn(serviceSidebarStyles.tile, serviceTileClass(serviceCode))}
        aria-hidden="true"
      >
        {(serviceName || serviceCode).charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span
          className={cn('line-clamp-3 break-words', serviceSidebarStyles.rowName)}
          title={serviceName || undefined}
        >
          {serviceName || serviceCode}
        </span>
        {/* Same rule as the row: with no name the code IS the name line, so there is
            nothing left to tag. */}
        {serviceName && <span className={serviceSidebarStyles.rowCode}>{serviceCode}</span>}
      </span>
    </div>
  </ConfirmStepModal>
);
