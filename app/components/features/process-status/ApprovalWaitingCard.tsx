'use client';

import { useModal } from '@/app/hooks/useModal';
import { ApprovalRequestDetailModal } from './ApprovalRequestDetailModal';
import { CancelApprovalModal } from './CancelApprovalModal';
import { ConfirmedIntegrationCollapse } from './ConfirmedIntegrationCollapse';
import { cn, statusColors, getButtonClass } from '@/lib/theme';
import type { ApprovalRequestReadModel } from '@/lib/types';

interface ApprovalWaitingCardProps {
  targetSourceId: number;
  onCancelSuccess: () => void;
  hasConfirmedIntegration?: boolean;
  request: ApprovalRequestReadModel | null;
}

export const ApprovalWaitingCard = ({
  targetSourceId,
  onCancelSuccess,
  hasConfirmedIntegration,
  request,
}: ApprovalWaitingCardProps) => {
  const detailModal = useModal();
  const cancelModal = useModal();

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
                disabled={!request}
                className={getButtonClass('ghost', 'sm')}
              >
                요청 내용 확인
              </button>
              <button
                onClick={() => cancelModal.open()}
                className={getButtonClass('secondary', 'sm')}
              >
                요청 취소
              </button>
            </div>
            {hasConfirmedIntegration && (
              <ConfirmedIntegrationCollapse
                targetSourceId={targetSourceId}
                label="현재 연동 정보 보기"
              />
            )}
          </div>
        </div>
      </div>

      <ApprovalRequestDetailModal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        request={request}
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
