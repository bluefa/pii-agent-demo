'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { cardStyles, cn, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface InstallationCompleteStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const InstallationCompleteStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: InstallationCompleteStepProps) => (
  <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta
      project={project}
      providerLabel={providerLabel}
      identity={identity}
      action={action}
    />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>
            PII 모니터링 모듈 연동 완료
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            PII가 사용되어 있을 가능성이 있어요. 사용 단어 빈도가 표시되며, 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
          </p>
        </div>
      </header>
      <div className="p-6">
        <ConfirmedResourcesSlot />
      </div>
    </section>
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
