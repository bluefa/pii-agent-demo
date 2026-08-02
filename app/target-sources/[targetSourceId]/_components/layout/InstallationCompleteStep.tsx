'use client';

import { useState, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import {
  CardActionBar,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/target-sources/[targetSourceId]/_components/common/warning-outline-button';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { HealthBadge } from '@/app/target-sources/[targetSourceId]/_components/confirmed/HealthBadge';
import { aggregateHealth } from '@/app/target-sources/[targetSourceId]/_components/confirmed/health-status';
import {
  ConfirmedIntegrationDataProvider,
  useConfirmedIntegration,
} from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface InstallationCompleteStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action?: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const InstallationCompleteHeaderRight = () => {
  const { state } = useConfirmedIntegration();
  if (state.status !== 'ready') return null;
  return <HealthBadge status={aggregateHealth(state.data)} />;
};

/**
 * 인프라 변경 / 연결 테스트 재실행 — the C-2 action zone at the card bottom
 * (CardActionBar, same grammar as the step-5 완료 승인 요청 bar), with the
 * rewind consequences spelled out in the hint.
 */
const InstallationCompleteActionBar = () => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);

  // v16 confirmStepProceed rewinds the stepper; the rewind endpoint is not in the
  // contract yet, so confirming surfaces a placeholder until the BFF wires it.
  const handleConfirm = (kind: ConfirmRewindKind) => {
    setConfirmKind(null);
    toast.info(
      kind === 'infra'
        ? '인프라 변경(1단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.'
        : '연결 테스트 재실행(5단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.',
    );
  };

  return (
    <CardActionBar hint="※ 인프라 변경은 1단계, 연결 테스트 재실행은 5단계로 되돌아가 프로세스를 다시 진행해요.">
      <button
        type="button"
        className={WARNING_OUTLINE_BUTTON_CLASS}
        onClick={() => setConfirmKind('infra')}
      >
        <EditIcon className="w-[13px] h-[13px]" />
        인프라 변경
      </button>
      <button
        type="button"
        className={WARNING_OUTLINE_BUTTON_CLASS}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        연결 테스트 재실행
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
      />
    </CardActionBar>
  );
};

/**
 * Cloud Step 7 — PII 모니터링 모듈 연동 (연동 완료, read-only).
 * Same header stack as steps 2·3·6: step tag, title + success badge (health badge
 * outermost), guidance copy. The rewind CTAs dock in the bottom CardActionBar.
 */
export const InstallationCompleteStep = ({
  project,
  identity,
  providerLabel,
  action,
}: InstallationCompleteStepProps) => {

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      {/* No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar. */}
      <section className={cardStyles.base}>
        <header className={cardStyles.header}>
          <span className={cardStyles.stepTag}>7번째 단계</span>
          <div className="flex items-center justify-between gap-4">
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
            {/* C-3: the aggregate health badge stays pinned to the header right. */}
            <div className="shrink-0">
              <InstallationCompleteHeaderRight />
            </div>
          </div>
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>
              모든 연동 절차가 완료되었어요.
            </strong>{' '}
            연동된 리소스에서 PII 사용 가능성을 모니터링하고 있으며, 사용 단어 빈도가 표시돼요.
          </p>
          {/* No top margin — the 1.55 leading is the paragraph break (step-2 grammar). */}
          <p className={cardStyles.guidance}>
            DB가 변경·추가되었다면 하단{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>인프라 변경</strong>으로
            프로세스를 재수행해 Agent 설치까지 다시 진행하고, 연결 상태를 다시 점검하고 싶다면{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>연결 테스트 재실행</strong>
            을 눌러주세요.
          </p>
        </header>
        <div className={cardStyles.body}>
          <ConfirmedResourcesSlot bare />
        </div>
        {/* C-2 action zone: the rewind CTAs dock (sticky) at the card bottom. */}
        <InstallationCompleteActionBar />
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
