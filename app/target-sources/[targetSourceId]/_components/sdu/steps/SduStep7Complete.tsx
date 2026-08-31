'use client';

import type { CloudTargetSource } from '@/lib/types';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { EditIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { ConfirmRewindModal } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { useRewindStep } from '@/app/target-sources/[targetSourceId]/_components/layout/useRewindStep';
import { SduUploadSummary } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduUploadSummary';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

/** 클라우드·IDC Step 7 과 같은 잠금 — 갱신이 도는 동안 되돌리기 버튼을 다시 누르지 못하게 한다. */
const REWIND_BTN_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45';

/**
 * ONE rewind, where the cloud and IDC steps expose two. 연결 테스트 재실행 is not offered
 * because the connection test is not on the SDU road: the test runs, but the admin runs it,
 * and a button that re-opens a step the reader cannot stand on would be the screen
 * offering work it cannot accept.
 */
const CompleteActionBar = ({
  targetSourceId,
  onProjectUpdate,
}: {
  targetSourceId: number;
  onProjectUpdate: (project: CloudTargetSource) => void;
}) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].complete;
  const rewind = useRewindStep(targetSourceId, onProjectUpdate);

  return (
    <CardActionBar hint={t.actionHint}>
      <button
        type="button"
        disabled={rewind.pending}
        className={cn(idcStyles.triggerBtn.warnOutline, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('sduRedefine')}
      >
        <EditIcon className="w-3.5 h-3.5" />
        {t.editTargets}
      </button>
      <ConfirmRewindModal
        kind={rewind.confirmKind}
        onClose={rewind.close}
        onConfirm={rewind.confirm}
        isPending={rewind.pending}
      />
    </CardActionBar>
  );
};

/**
 * SDU Step 7 — 완료.
 *
 * Same head stack as every other Step 7 — step tag, title, 연동 완료 badge, then the two
 * guidance sentences — because a finished SDU target and a finished AWS target are the
 * same news and should not arrive in two different shapes.
 *
 * What it does NOT borrow is the body. The cloud and IDC step 7s close on a resource table,
 * which SDU has nothing to fill: the owner uploaded files, and the DBs behind them were
 * never scanned into a list this page can show. The upload recap stands there instead —
 * the same four values step 6 ended on, so the screen the reader was watching yesterday
 * and the screen they land on today agree about what happened.
 *
 * No `RejectionAlert`: SDU has no approval step, so there is no verdict that could reject.
 */
export const SduStep7Complete = ({ project, onProjectUpdate }: SduStepProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].complete;

  return (
    // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
    <section className={cardStyles.base}>
      <header className={cardStyles.header}>
        <div className="flex items-center gap-2">
          <span className={cardStyles.stepTag}>{t.stepTag}</span>
          <h2 className={cardStyles.cardTitle}>{t.title}</h2>
          <span
            className={cn(
              cardStyles.stepBadge,
              statusColors.success.bg,
              statusColors.success.textDark,
            )}
          >
            {t.badge}
          </span>
        </div>
        <p className={cn('mt-3', cardStyles.guidance)}>
          <strong className={cn('font-semibold', primaryColors.text)}>{t.guidanceStrong}</strong>{' '}
          {t.guidanceRest}
        </p>
        <p className={cardStyles.guidance}>
          {t.rewindHintHead}
          <strong className={cn('font-semibold', textColors.secondary)}>{t.editTargets}</strong>
          {t.rewindHintTail}
        </p>
      </header>
      <div className={cardStyles.body}>
        <SduUploadSummary targetSourceId={project.targetSourceId} />
      </div>
      {/* C-2 action zone: the rewind CTA docks (sticky) at the card bottom. */}
      <CompleteActionBar
        targetSourceId={project.targetSourceId}
        onProjectUpdate={onProjectUpdate}
      />
    </section>
  );
};
