'use client';

import { useEffect, useState } from 'react';
import { cn, statusColors, textColors } from '@/lib/theme';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getTestConnectionDetail } from '@/app/lib/api/task-queue-tc';

interface RejectionInfo {
  reason: string | null;
  rejectedAt: string | null;
}

interface TcRejectionNoticeProps {
  targetSourceId: number;
  /**
   * 최신 실행 버전 — 반려는 재실행으로 풀리므로, 새 실행이 생기면 반려 상태를 다시
   * 읽어야 한다. 이게 없으면 재실행에 성공해도 remount 전까지 반려 안내가 남는다.
   */
  runVersion?: number | null;
}

/**
 * 관리자 재실행 요청(반려) 안내 — GET …/test-connection/status 단건의
 * reject_reason/rejected_at 을 Step 5 에서 처음으로 사용자에게 보여준다.
 * 반려 상태가 아니면 아무것도 그리지 않는다. 조회 실패는 "반려 아님"과 다른
 * 사실이라 삼키지 않고 회색 한 줄로 남긴다 — 반려 사유는 이 화면에서 여기에만
 * 있어서, 침묵하면 반려된 사용자가 사유 없이 막힌다.
 */
export const TcRejectionNotice = ({ targetSourceId, runVersion }: TcRejectionNoticeProps) => {
  const [info, setInfo] = useState<RejectionInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getTestConnectionDetail(targetSourceId, { signal: controller.signal })
      .then((row) => {
        if (controller.signal.aborted) return;
        setFailed(false);
        setInfo(
          row.status === 'TEST_CONNECTION_REJECTED'
            ? { reason: row.rejectReason, rejectedAt: row.rejectedAt }
            : null,
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setInfo(null);
      });
    return () => controller.abort();
  }, [targetSourceId, runVersion]);

  if (failed) {
    return (
      <p className={cn('text-[12px]', textColors.tertiary)}>
        관리자 반려 여부를 확인하지 못했어요 — 새로고침 후 다시 확인해 주세요.
      </p>
    );
  }

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
