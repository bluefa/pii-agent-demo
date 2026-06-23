'use client';

import { useState } from 'react';
import { getApprovalRequestLatest } from '@/app/lib/api';
import type { ApprovalRequestLatestResponse } from '@/app/lib/api';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { AppError } from '@/lib/errors';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { CheckIcon } from '@/app/components/ui/icons';

interface ApprovalApplyingBannerProps {
  targetSourceId?: number;
}

export const ApprovalApplyingBanner = ({
  targetSourceId,
}: ApprovalApplyingBannerProps) => {
  const [latestResponse, setLatestResponse] = useState<ApprovalRequestLatestResponse | null>(null);
  const totalCount = latestResponse?.request?.resource_selected_count ?? 0;

  useAbortableEffect((signal) => {
    if (!targetSourceId) return undefined;
    return getApprovalRequestLatest(targetSourceId, { signal })
      .then((response) => {
        if (signal.aborted) return;
        setLatestResponse(response);
      })
      .catch((err) => {
        if (err instanceof AppError && err.code === 'ABORTED') throw err;
        // Intentional silent ignore — failure here only hides the count summary.
      });
  }, [targetSourceId]);

  return (
    <StepBanner variant="success" icon={<CheckIcon className="w-[18px] h-[18px]" />}>
      <strong className="font-bold">승인이 완료되어 시스템에 반영 중입니다.</strong>
      {totalCount > 0 ? (
        <>
          {' '}전체 <span className="tabular-nums">{totalCount}</span>건 · 평균 5분 내외 소요
        </>
      ) : (
        <>{' '}평균 5분 내외 소요</>
      )}
    </StepBanner>
  );
};
