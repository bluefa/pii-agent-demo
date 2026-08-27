'use client';

import type { CloudTargetSource } from '@/lib/types';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { EditIcon } from '@/app/components/ui/icons';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { ConfirmRewindModal } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { useRewindStep } from '@/app/target-sources/[targetSourceId]/_components/layout/useRewindStep';
import { SduUploadSummary } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduUploadSummary';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

/** 클라우드·IDC Step 7 과 같은 잠금 — 갱신이 도는 동안 되돌리기 버튼을 다시 누르지 못하게 한다. */
const REWIND_BTN_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45';

/**
 * ONE rewind, where the cloud and IDC steps expose two. 연결 테스트 재실행 is not offered
 * because 5단계 is struck through on the SDU road: the test runs, but the admin runs it,
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
  const rewind = useRewindStep(targetSourceId, onProjectUpdate);

  return (
    <CardActionBar hint="※ 연동 대상 수정은 1단계로 되돌아가 연동 대상 정의부터 다시 진행해요.">
      <button
        type="button"
        disabled={rewind.pending}
        className={cn(idcStyles.triggerBtn.warnOutline, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('sduRedefine')}
      >
        <EditIcon className="w-3.5 h-3.5" />
        연동 대상 수정
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
export const SduStep7Complete = ({ project, onProjectUpdate }: SduStepProps) => (
  // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
  <section className={cardStyles.base}>
    <header className={cardStyles.header}>
      <div className="flex items-center gap-2">
        <span className={cardStyles.stepTag}>7단계</span>
        <h2 className={cardStyles.cardTitle}>PII 모니터링 모듈 연동</h2>
        <span
          className={cn(
            cardStyles.stepBadge,
            statusColors.success.bg,
            statusColors.success.textDark,
          )}
        >
          연동 완료
        </span>
      </div>
      <p className={cn('mt-3', cardStyles.guidance)}>
        <strong className={cn('font-semibold', primaryColors.text)}>
          모든 연동 절차가 완료되었어요.
        </strong>{' '}
        업로드하신 데이터의 PII 사용 가능성을 모니터링하고 있어요.
      </p>
      <p className={cardStyles.guidance}>
        업로드할 대상이나 업로드 IP가 바뀌었다면 하단{' '}
        <strong className={cn('font-semibold', textColors.secondary)}>연동 대상 수정</strong>을
        눌러주세요.
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
