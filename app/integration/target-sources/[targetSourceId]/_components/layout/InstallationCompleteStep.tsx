'use client';

import { useState, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cardStyles, cn, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/integration/target-sources/[targetSourceId]/_components/common/warning-outline-button';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { HealthBadge } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/HealthBadge';
import { aggregateHealth } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';
import {
  ConfirmedIntegrationDataProvider,
  useConfirmedIntegration,
} from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface InstallationCompleteStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const InstallationCompleteHeaderRight = () => {
  const { state } = useConfirmedIntegration();
  if (state.status !== 'ready') return null;
  return <HealthBadge status={aggregateHealth(state.data)} />;
};

const InstallationCompleteActions = () => {
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
    <div className="flex justify-end gap-2 mb-3">
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
    </div>
  );
};

export const InstallationCompleteStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: InstallationCompleteStepProps) => {
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    project.processStatus,
  );

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <h2 className={cardStyles.cardTitle}>
              PII 모니터링 모듈 연동 완료
            </h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              PII가 사용되어 있을 가능성이 있어요. 사용 단어 빈도가 표시되며, 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
            </p>
          </div>
          <InstallationCompleteHeaderRight />
        </header>
        <div className={cardStyles.body}>
          <InstallationCompleteActions />
          <ConfirmedResourcesSlot variant="complete" bare />
        </div>
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
