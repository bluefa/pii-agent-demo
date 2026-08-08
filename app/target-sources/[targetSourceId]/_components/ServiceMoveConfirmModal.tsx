'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { cn, identityBarStyles, serviceSidebarStyles } from '@/lib/theme';

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
    // The destination moved out of the sentence and into the card below: name and code
    // ran together in one line as `이름 (코드)`, which is an apposition, not a hierarchy.
    description="아래 서비스의 인프라 목록으로 이동해요. 지금 보고 있는 화면에서 벗어나요."
    confirmLabel="이동하기"
  >
    {/*
      Two labelled fields in one card, not a sentence and not a repeated list row.
      Name and code stop competing for the same tier: each is named, then shown.
      That also drops the question of which side the code belongs on — a 50-character
      name wraps to two lines and the code simply starts its own field below it.

      IdentityBar's field grammar (12/600 key over its value) is the app's existing
      way of labelling a value, so nothing new is defined here. Bordered rather than
      tinted: on the modal's white body a fill light enough to stay quiet would be
      invisible (the rail's search field makes the same call).
    */}
    <dl className="flex flex-col gap-3.5 rounded-[12px] border border-[#EBEEF2] px-4 py-3.5">
      {/* No name, no name field — a placeholder dash would be a value the API never
          sent. The code field alone still answers "which service". */}
      {serviceName && (
        <div className={identityBarStyles.field}>
          <dt className={identityBarStyles.key}>서비스 이름</dt>
          {/* line-clamp-3 mirrors ServiceRow: the cap sits past any real name, and the
              tooltip holds whatever it would cut. */}
          <dd
            className={cn('m-0 line-clamp-3 break-words', serviceSidebarStyles.rowName)}
            title={serviceName}
          >
            {serviceName}
          </dd>
        </div>
      )}
      <div className={identityBarStyles.field}>
        <dt className={identityBarStyles.key}>서비스 코드</dt>
        {/* The rail's code tag, kept: with `font-mono` now resolving to Pretendard, the
            grey plate is what still reads the code as an identifier rather than prose. */}
        <dd className="m-0">
          <span className={serviceSidebarStyles.rowCode}>{serviceCode}</span>
        </dd>
      </div>
    </dl>
  </ConfirmStepModal>
);
