'use client';

import { useEffect, useState } from 'react';
import { cn, statusColors } from '@/lib/theme';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getTestConnectionDetail } from '@/app/lib/api/task-queue-tc';

interface RejectionInfo {
  reason: string | null;
  rejectedAt: string | null;
}

/**
 * 관리자 재실행 요청(반려) 안내 — GET …/test-connection/status 단건의
 * reject_reason/rejected_at 을 Step 5 에서 처음으로 사용자에게 보여준다.
 * 반려 상태가 아니면 아무것도 그리지 않는다 (조회 실패도 조용히 삼킨다 —
 * 이 카드는 부가 설명이지 화면의 게이트가 아니다).
 */
export const TcRejectionNotice = ({ targetSourceId }: { targetSourceId: number }) => {
  const [info, setInfo] = useState<RejectionInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getTestConnectionDetail(targetSourceId, { signal: controller.signal })
      .then((row) => {
        if (controller.signal.aborted) return;
        setInfo(
          row.status === 'TEST_CONNECTION_REJECTED'
            ? { reason: row.rejectReason, rejectedAt: row.rejectedAt }
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setInfo(null);
      });
    return () => controller.abort();
  }, [targetSourceId]);

  if (!info) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2.5',
        statusColors.warning.bgSoft,
        statusColors.warning.border,
      )}
    >
      <StatusWarningIcon className={cn('mt-0.5 h-4 w-4 shrink-0', statusColors.warning.textDark)} />
      <div className="min-w-0 text-[14px]">
        <p className={cn('font-bold', statusColors.warning.textDark)}>
          관리자가 연결 테스트 재실행을 요청했어요
          {info.rejectedAt && (
            <span className="ml-2 text-[12px] font-medium opacity-80">{fmtDateTime(info.rejectedAt)}</span>
          )}
        </p>
        {info.reason && (
          <p className={cn('mt-0.5 break-keep', statusColors.warning.textDark)}>{info.reason}</p>
        )}
      </div>
    </div>
  );
};
