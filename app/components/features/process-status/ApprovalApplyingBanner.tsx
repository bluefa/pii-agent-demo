'use client';

import { useState, useEffect } from 'react';
import { getApprovalHistory } from '@/app/lib/api';
import type { ApprovalHistoryResponse } from '@/app/lib/api';
import { useModal } from '@/app/hooks/useModal';
import { ApprovalRequestDetailModal } from './ApprovalRequestDetailModal';
import { ConfirmedIntegrationCollapse } from './ConfirmedIntegrationCollapse';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

type ApprovalRequest = ApprovalHistoryResponse['content'][0]['request'];

interface ApprovalApplyingBannerProps {
  targetSourceId?: number;
  hasConfirmedIntegration?: boolean;
}

export const ApprovalApplyingBanner = ({
  targetSourceId,
  hasConfirmedIntegration,
}: ApprovalApplyingBannerProps) => {
  const detailModal = useModal();
  const [latestRequest, setLatestRequest] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    if (!targetSourceId) return;
    let cancelled = false;
    getApprovalHistory(targetSourceId, 0, 1)
      .then((history) => {
        if (!cancelled && history.content.length > 0) {
          setLatestRequest(history.content[0].request);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetSourceId]);

  return (
    <>
      <div className={cn(
        'w-full p-4 rounded-lg border mb-3',
        statusColors.info.bg,
        statusColors.info.border,
      )}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
            <svg className={cn('w-5 h-5', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={cn('font-medium', statusColors.info.textDark)}>
              승인이 완료되어 연동을 반영하고 있습니다
            </p>
            <p className={cn('text-sm mt-1', statusColors.info.text)}>
              {hasConfirmedIntegration
                ? '기존 연동 대상이 신규 연동 대상으로 전환됩니다. 반영은 최대 하루 소요될 수 있습니다.'
                : '반영은 최대 하루 소요될 수 있습니다. 완료 시 알림을 보내드립니다.'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => detailModal.open()}
                disabled={!latestRequest}
                className={getButtonClass('ghost', 'sm')}
              >
                승인 내역 확인
              </button>
            </div>
            {hasConfirmedIntegration && targetSourceId && (
              <ConfirmedIntegrationCollapse
                targetSourceId={targetSourceId}
                label="이전 연동 정보 보기"
              />
            )}
          </div>
        </div>
      </div>

      <ApprovalRequestDetailModal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        request={latestRequest}
      />
    </>
  );
};
