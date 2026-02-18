'use client';

import { useState, useEffect } from 'react';
import { useModal } from '@/app/hooks/useModal';
import { getApprovalHistory } from '@/app/lib/api';
import type { ApprovalHistoryResponse } from '@/app/lib/api';
import { ApprovalRequestDetailModal } from './ApprovalRequestDetailModal';
import { CancelApprovalModal } from './CancelApprovalModal';
import { cn, statusColors } from '@/lib/theme';

type ApprovalRequest = ApprovalHistoryResponse['content'][0]['request'];

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
  const [latestRequest, setLatestRequest] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchLatest = async () => {
      try {
        const history = await getApprovalHistory(targetSourceId, 0, 1);
        if (!cancelled && history.content.length > 0) {
          setLatestRequest(history.content[0].request);
        }
      } catch {
        // 조회 실패 시 무시 — 요청 내용 확인 버튼만 비활성화
      }
    };
    fetchLatest();
    return () => { cancelled = true; };
  }, [targetSourceId]);

  return (
    <>
      <div className={cn(
        'w-full p-4 rounded-lg border',
        statusColors.info.bg,
        statusColors.info.border,
      )}>
        <div className="flex items-start gap-3">
          {/* 시계 아이콘 */}
          <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {/* 액션 버튼 */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => detailModal.open()}
                disabled={!latestRequest}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                요청 내용 확인
              </button>
              <button
                onClick={() => cancelModal.open()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                요청 취소
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 요청 상세 모달 */}
      <ApprovalRequestDetailModal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        request={latestRequest}
      />

      {/* 취소 확인 모달 */}
      <CancelApprovalModal
        isOpen={cancelModal.isOpen}
        onClose={cancelModal.close}
        targetSourceId={targetSourceId}
        onCancelSuccess={onCancelSuccess}
      />
    </>
  );
};
