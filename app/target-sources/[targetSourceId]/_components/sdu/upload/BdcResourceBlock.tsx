'use client';

import { getProject } from '@/app/lib/api';
import { getSduUpload } from '@/app/lib/api/sdu';
import {
  INSTALL_POLL_INTERVAL_MS,
  useInstallationStatus,
} from '@/app/hooks/useInstallationStatus';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { cn, stackGap, textColors, textStyles } from '@/lib/theme';
import type { CloudTargetSource } from '@/lib/types';
import type { SduBdc, SduUpload } from '@/lib/types/sdu';

export interface BdcResourceBlockProps {
  targetSourceId: number;
  /** The snapshot the card already loaded — the first paint does not wait for the poll. */
  bdc: SduBdc;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const isBdcComplete = (upload: SduUpload): boolean => upload.bdc.status === 'COMPLETED';

/**
 * 4-4 BDC 리소스 생성.
 *
 * What is being built is deliberately absent — no resource list, no step rail, no counts. The
 * owner cannot act on any of it, and a failure shown in a place with no remedy is worse than
 * no line at all; the admin's 인프라 작업 탭 owns the detail. The only fact this block carries
 * is "it is running", and the only thing that proves it is a number that moves on its own.
 *
 * No refresh button: the poll is silent and 30s long, so a button would mostly do nothing
 * visible. 4-1's 「다시 조회」 is a different act — there the owner is re-reading a list that a
 * cloud provider may have changed under them.
 */
export const BdcResourceBlock = ({ targetSourceId, bdc, onProjectUpdate }: BdcResourceBlockProps) => {
  const { status } = useInstallationStatus<SduUpload>({
    targetSourceId,
    getFn: getSduUpload,
    isComplete: isBdcComplete,
    pollIntervalMs: INSTALL_POLL_INTERVAL_MS,
    onComplete: () => {
      // The step moves because process-status moved, not because this block says so — so the
      // project is re-read and handed up. If that read fails the completion is still true on
      // the server and the next read of the page carries it; nothing here can improve on that.
      void getProject(targetSourceId)
        .then(onProjectUpdate)
        .catch(() => undefined);
    },
  });

  const live = status?.bdc ?? bdc;

  if (live.status === 'NOT_STARTED') {
    return (
      <p className={cn(textStyles.body, textColors.tertiary)}>앞의 확인이 끝나면 시작돼요.</p>
    );
  }

  return (
    <div className={cn('flex flex-col items-center py-8 text-center', stackGap.related)}>
      <h4 className={cn(textStyles.sectionTitle, textColors.primary)}>
        BDC측에서 설치를 위해 리소스를 생성하고 있습니다
      </h4>
      <p className={cn(textStyles.body, textColors.secondary)}>
        담당자가 하실 일은 없어요. 생성이 끝나면 다음 단계로 넘어가요.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <span className={cn(textStyles.caption, textColors.tertiary)}>30초마다 자동 확인</span>
        <LastCheckStamp lastCheck={{ status: 'IN_PROGRESS', checkedAt: live.checkedAt }} />
      </div>
    </div>
  );
};
