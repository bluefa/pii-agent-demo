'use client';

import { useState } from 'react';
import { useModal } from '@/app/hooks/useModal';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getApprovalRequestLatest } from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import type { ApprovalRequestLatestResponse } from '@/app/lib/api';
import { ApprovalRequestDetailModal } from './ApprovalRequestDetailModal';
import { CancelApprovalModal } from './CancelApprovalModal';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

interface ApprovalWaitingCardProps {
  targetSourceId: number;
  onCancelSuccess: () => void;
}

export const ApprovalWaitingCard = ({
  targetSourceId,
  onCancelSuccess,
}: ApprovalWaitingCardProps) => {
  const detailModal = useModal();
  const cancelModal = useModal();
  const [latestResponse, setLatestResponse] = useState<ApprovalRequestLatestResponse | null>(null);

  useAbortableEffect((signal) =>
    getApprovalRequestLatest(targetSourceId, { signal })
      .then((response) => {
        if (signal.aborted) return;
        setLatestResponse(response);
      })
      .catch((err) => {
        if (err instanceof AppError && err.code === 'ABORTED') throw err;
        // Intentional silent ignore — failure only disables the detail button.
      }),
  [targetSourceId]);

  return (
    <>
      <div className={cn(
        'w-full p-4 rounded-lg border',
        statusColors.info.bg,
        statusColors.info.border,
      )}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
            <svg className={cn('w-5 h-5', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={cn('font-medium', statusColors.info.textDark)}>
              관리자 승인을 기다리고 있습니다
            </p>
            <p className={cn('text-sm mt-1', statusColors.info.text)}>
              승인이 완료되면 자동으로 연동이 시작됩니다.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => detailModal.open()}
                disabled={!latestResponse}
                className={getButtonClass('ghost', 'sm')}
              >
                요청 요약 보기
              </button>
              <button
                onClick={() => cancelModal.open()}
                className={getButtonClass('secondary', 'sm')}
              >
                요청 취소
              </button>
            </div>
          </div>
        </div>
      </div>

      <ApprovalRequestDetailModal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        latestResponse={latestResponse}
      />

      <CancelApprovalModal
        isOpen={cancelModal.isOpen}
        onClose={cancelModal.close}
        targetSourceId={targetSourceId}
        onCancelSuccess={onCancelSuccess}
      />
    </>
  );
};
