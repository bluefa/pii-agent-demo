'use client';

import { useCallback, useState } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject, updateTestConnectionConfirmation } from '@/app/lib/api';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { ConfirmedIntegrationDataProvider } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface ConnectionVerifiedStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const ConnectionVerifiedRetestButton = ({
  targetSourceId,
  onRolledBack,
}: {
  targetSourceId: number;
  onRolledBack: () => Promise<void>;
}) => {
  const toast = useToast();
  const { locale } = useLocale();
  const t = LAYOUT_COPY[locale].verified;
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // 되돌아가기 rolls back the completion acknowledgment (confirmed:false), which moves the
  // process status back to step 5; awaiting onRolledBack (getProject + onProjectUpdate)
  // ensures the UI transitions to the rewound step before the spinner clears.
  const handleConfirm = async () => {
    if (rollingBack) return;
    setRollingBack(true);
    try {
      await updateTestConnectionConfirmation(targetSourceId, false);
      setConfirmKind(null);
      await onRolledBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.retestFailed);
    } finally {
      setRollingBack(false);
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
        {t.retest}
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => (rollingBack ? undefined : setConfirmKind(null))}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export const ConnectionVerifiedStep = ({
  project,
  onProjectUpdate,
}: ConnectionVerifiedStepProps) => {
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];
  const t = copy.verified;

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        {/* Same left-aligned stack as steps 2·3: step tag, title + status, guidance copy. */}
        <header className={cardStyles.header}>
          {/* The tag, the title and the state badge are one row; the action holds the other
              end of it. This head had `cardStyles.stepTag` spelled out by hand instead of
              imported, which is how it sat out the move onto the title row — nothing that
              greps for the token could see it. */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* Step position, matching INSTALL_STEPS order in InstallationProcessProgressBar. */}
              <span className={cardStyles.stepTag}>{copy.common.step(6)}</span>
              <h2 className={cardStyles.cardTitle}>{t.title}</h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  statusColors.warning.bg,
                  statusColors.warning.textDark,
                )}
              >
                {t.badge}
              </span>
            </div>
            {/* C-3: auxiliary retest action pinned to the header right. When to press it is
                explained in the guidance copy below, not in a caption under the button. */}
            <div className="shrink-0">
              <ConnectionVerifiedRetestButton
                targetSourceId={project.targetSourceId}
                onRolledBack={refreshProject}
              />
            </div>
          </div>
          {/* Blue marks the status clause only, matching steps 2·3. */}
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>
              {t.guidanceStrong}
            </strong>{' '}
            {t.guidanceTail}
          </p>
          {/* No top margin — the 1.55 leading is the paragraph break (step-2 grammar). */}
          <p className={cardStyles.guidance}>
            {t.retestHintLead}
            <strong className={cn('font-semibold', textColors.secondary)}>{t.retest}</strong>
            {t.retestHintTail}
          </p>
        </header>
        <div className={cardStyles.body}>
          <ConfirmedResourcesSlot bare />
        </div>
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
