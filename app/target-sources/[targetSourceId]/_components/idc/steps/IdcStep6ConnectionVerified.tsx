'use client';

import { useState } from 'react';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { IdcConfirmedResourcesPanel } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { getProject, updateTestConnectionConfirmation } from '@/app/lib/api';
import { getIdcConfirmedResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';

/** 연결 테스트 재실행 — opens the confirm-rewind modal (mirrors the cloud sibling). */
const ConnectionVerifiedRetestButton = ({
  targetSourceId,
  onProjectUpdate,
}: {
  targetSourceId: number;
  onProjectUpdate: IdcStepProps['onProjectUpdate'];
}) => {
  const t = IDC_COPY[useLocale().locale];
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);

  // 되돌아가기: roll back the completion acknowledgment (confirmed:false). The mock
  // clears passedAt → the project returns to Step 5 (WAITING_CONNECTION_TEST); the
  // refetch then re-renders the rewound step.
  const handleConfirm = async () => {
    setConfirmKind(null);
    try {
      await updateTestConnectionConfirmation(targetSourceId, false);
      onProjectUpdate(await getProject(targetSourceId));
    } catch {
      toast.error(t.retestFailed);
    }
  };

  return (
    <>
      <button
        type="button"
        className={idcStyles.triggerBtn.linkWarn}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        {t.retestCta}
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

/**
 * IDC Step 6 — 완료 여부 관리자 승인 대기 (read-only).
 * Same shape as the cloud step: the header carries the step tag, the status badge and the
 * guidance copy, and the table swaps DB Credential / Connection Status for the Step 5
 * logical-DB result. Both dropped columns were placeholders here — the confirmed-integration
 * rows have no connection_status, so every row read "Pending" after a passing test.
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7)
 * via the shared `useIdcResources` read hook, never module-level state; the table
 * chrome lives in IdcConfirmedResourcesPanel (shared with Step 7).
 */
export const IdcStep6ConnectionVerified = ({
  project,
  onProjectUpdate,
}: IdcStepProps) => {
  const t = IDC_COPY[useLocale().locale];
  const { targetSourceId } = project;

  // Step 6 source: the confirmed list (confirmed-integration), same as cloud steps 4–7.
  const { state } = useIdcResources(targetSourceId, getIdcConfirmedResources);

  return (
    <>
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        {/* Same left-aligned stack as the cloud step: step tag, title + status, guidance copy. */}
        <header className={cardStyles.header}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className={cardStyles.stepTag}>{t.step(6)}</span>
              <h2 className={cardStyles.cardTitle}>{t.step6Title}</h2>
              <span
                className={cn(
                  cardStyles.stepBadge,
                  statusColors.warning.bg,
                  statusColors.warning.textDark,
                )}
              >
                {t.badgePending}
              </span>
            </div>
            {/* C-3: auxiliary retest action pinned to the header right. When to press it is
                explained in the guidance copy below, not in a caption under the button. */}
            <div className="shrink-0">
              <ConnectionVerifiedRetestButton
                targetSourceId={targetSourceId}
                onProjectUpdate={onProjectUpdate}
              />
            </div>
          </div>
          {/* The header subtitle and the info banner said the same thing; the banner is gone.
              Blue marks the status clause only, matching steps 2·3. */}
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>{t.step6GuideEm}</strong>{' '}
            {t.step6GuideRest}
          </p>
          {/* No top margin — the 1.55 leading is the paragraph break (step-2 grammar). */}
          <p className={cardStyles.guidance}>
            {t.step6RetestBefore}
            <strong className={cn('font-semibold', textColors.secondary)}>{t.retestCta}</strong>
            {t.step6RetestAfter}
          </p>
        </header>
        <div className={cardStyles.body}>
          <IdcConfirmedResourcesPanel
            targetSourceId={targetSourceId}
            scope="latestSuccess"
            state={state}
          />
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
