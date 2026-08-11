'use client';

import type { CloudTargetSource } from '@/lib/types';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import {
  CardActionBar,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { ConfirmRewindModal } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { useRewindStep } from '@/app/target-sources/[targetSourceId]/_components/layout/useRewindStep';
import { IdcConfirmedResourcesPanel } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { getIdcConfirmedResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

/** 클라우드 Step 7 과 같은 잠금 — 갱신이 도는 동안 되돌리기 버튼을 다시 누르지 못하게 한다. */
const REWIND_BTN_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45';

/**
 * 인프라 변경 / 연결 테스트 재실행 — the C-2 action zone at the card bottom
 * (CardActionBar, same grammar as the step-5 완료 승인 요청 bar), with the
 * rewind consequences spelled out in the hint.
 *
 * 두 되돌리기는 실제 API 를 쏜다 (useRewindStep) — 클라우드 Step 7 과 같은 두 호출이다.
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
    <CardActionBar hint="※ 인프라 변경은 1단계, 연결 테스트 재실행은 5단계로 되돌아가 프로세스를 다시 진행해요.">
      <button
        type="button"
        disabled={rewind.pending}
        className={cn(idcStyles.triggerBtn.warnOutline, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('infra')}
      >
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </button>
      <button
        type="button"
        disabled={rewind.pending}
        className={cn(idcStyles.triggerBtn.warnOutline, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('retest')}
      >
        <ReloadIcon className="w-3.5 h-3.5" />
        연결 테스트 재실행
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
 * IDC Step 7 — PII 모니터링 모듈 연동 (연동 완료, read-only).
 * Same header stack as steps 1·2·3·6: step tag, title + success badge, guidance copy.
 * The resource table follows Step 6 (toolbar + logical-DB column + pagination) via the
 * shared IdcConfirmedResourcesPanel; the rewind CTAs dock in the bottom CardActionBar.
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep7Complete = ({
  project,
  onProjectUpdate,
}: IdcStepProps) => {

  // Step 7 source: the confirmed list (confirmed-integration), same as cloud steps 4–7.
  const { state } = useIdcResources(project.targetSourceId, getIdcConfirmedResources);

  return (
    <>
      {/* No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar. */}
      <section className={cardStyles.base}>
        <header className={cardStyles.header}>
          <span className={cardStyles.stepTag}>7번째 단계</span>
          <div className="flex items-center gap-2">
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
            연동된 리소스의 PII 사용 가능성을 모니터링하고 있어요.
          </p>
          {/* One sentence for the rewind CTAs (step-6 grammar); the step each one lands on
              is the action bar hint's job. */}
          <p className={cardStyles.guidance}>
            인프라 구성이 바뀌었다면 하단{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>인프라 변경</strong>을,
            연결 상태를 다시 점검하고 싶다면{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>연결 테스트 재실행</strong>
            을 눌러주세요.
          </p>
        </header>
        <div className={cardStyles.body}>
          <IdcConfirmedResourcesPanel targetSourceId={project.targetSourceId} state={state} />
        </div>
        {/* C-2 action zone: the rewind CTAs dock (sticky) at the card bottom. */}
        <CompleteActionBar
          targetSourceId={project.targetSourceId}
          onProjectUpdate={onProjectUpdate}
        />
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
