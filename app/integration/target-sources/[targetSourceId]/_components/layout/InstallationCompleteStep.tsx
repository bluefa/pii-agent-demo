'use client';

import type { ReactNode } from 'react';
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
  const stub = (label: string) => () => toast.info(`${label} 기능 준비중입니다.`);
  return (
    <div className="flex justify-end gap-2 mb-3">
      <button
        type="button"
        className={WARNING_OUTLINE_BUTTON_CLASS}
        onClick={stub('인프라 변경')}
      >
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </button>
      <button
        type="button"
        className={WARNING_OUTLINE_BUTTON_CLASS}
        onClick={stub('연결 테스트 재실행')}
      >
        <ReloadIcon className="w-3.5 h-3.5" />
        연결 테스트 재실행
      </button>
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
    project.awsInstallationMode,
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
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              PII가 사용되어 있을 가능성이 있어요. 사용 단어 빈도가 표시되며, 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
            </p>
          </div>
          <InstallationCompleteHeaderRight />
        </header>
        <div className="p-6">
          <InstallationCompleteActions />
          <ConfirmedResourcesSlot variant="complete" />
        </div>
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
