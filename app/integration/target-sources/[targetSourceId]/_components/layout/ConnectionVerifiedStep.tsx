'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ClockIcon } from '@/app/components/ui/icons';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface ConnectionVerifiedStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const ConnectionVerifiedStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: ConnectionVerifiedStepProps) => (
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
            완료 여부 관리자 승인 대기
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            statusColors.warning.bg,
            statusColors.warning.textDark,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
          승인 대기
        </span>
      </header>
      <div className="p-6">
        <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">최종 관리자 승인을 기다리고 있어요.</strong>
          {' '}승인이 완료되면 모니터링이 즉시 시작됩니다.
        </StepBanner>
        <ConfirmedResourcesSlot />
      </div>
    </section>
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
