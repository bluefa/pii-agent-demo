'use client';

import type { CloudTargetSource } from '@/lib/types';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import {
  CardActionBar,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/target-sources/[targetSourceId]/_components/common/warning-outline-button';
import { ConfirmRewindModal } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { useRewindStep } from '@/app/target-sources/[targetSourceId]/_components/layout/useRewindStep';
import { ConfirmedIntegrationDataProvider } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

/**
 * 되돌리기가 도는 동안 두 버튼을 잠근다. 훅이 두 번째 호출을 막고는 있지만, 뮤테이션이
 * 끝난 뒤 project 를 다시 읽는 구간에는 화면이 아직 되감기 전 단계를 보여준다 — 그때
 * 살아 있는 버튼은 이미 되돌아간 과제에 한 번 더 누르라고 권하는 셈이다.
 */
const REWIND_BTN_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45';

interface InstallationCompleteStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

/**
 * 인프라 변경 / 연결 테스트 재실행 — the C-2 action zone at the card bottom
 * (CardActionBar, same grammar as the step-5 완료 승인 요청 bar), with the
 * rewind consequences spelled out in the hint.
 *
 * 두 되돌리기는 실제 API 를 쏜다 (useRewindStep): 인프라 변경 → POST …/reset,
 * 연결 테스트 재실행 → PUT …/test-connection-acknowledgment { confirmed:false }.
 */
const InstallationCompleteActionBar = ({
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
        className={cn(WARNING_OUTLINE_BUTTON_CLASS, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('infra')}
      >
        <EditIcon className="w-[13px] h-[13px]" />
        인프라 변경
      </button>
      <button
        type="button"
        disabled={rewind.pending}
        className={cn(WARNING_OUTLINE_BUTTON_CLASS, REWIND_BTN_DISABLED)}
        onClick={() => rewind.open('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
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
 * Cloud Step 7 — PII 모니터링 모듈 연동 (연동 완료, read-only).
 * Same header stack as steps 2·3·6: step tag, title + success badge, guidance copy.
 * The rewind CTAs dock in the bottom CardActionBar. No header health badge — the
 * per-row Status column left the table (live review), so its aggregate goes with it
 * until a proper health surface is designed.
 */
export const InstallationCompleteStep = ({
  project,
  onProjectUpdate,
}: InstallationCompleteStepProps) => {

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
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
          <ConfirmedResourcesSlot bare />
        </div>
        {/* C-2 action zone: the rewind CTAs dock (sticky) at the card bottom. */}
        <InstallationCompleteActionBar
          targetSourceId={project.targetSourceId}
          onProjectUpdate={onProjectUpdate}
        />
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
