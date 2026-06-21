'use client';

import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, statusColors, textColors } from '@/lib/theme';
import { CheckIcon } from '@/app/components/ui/icons';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { LoadingState, ErrorState } from '@/app/components/ui/state';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { useIdcResources } from '@/app/hooks/useIdcResources';

/**
 * IDC Step 3 — 연동 대상 반영중 (read-only).
 * Chrome + read-only IdcResourceTable (cols `src`, `excl`; excluded rows shown).
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep3Applying = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.APPLYING_APPROVED);

  const { state } = useIdcResources(project.targetSourceId);

  return (
    <>
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
            <h2 className={cardStyles.cardTitle}>연동 대상 반영중</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              관리자 승인 후 시스템에 연동 정보를 반영하고 있어요.
            </p>
          </div>
          <span
            className={cn(
              idcStyles.statusPill,
              statusColors.warning.bg,
              statusColors.warning.textDark,
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
            반영중
          </span>
        </header>
        <div className="p-6">
          <StepBanner variant="success" icon={<CheckIcon className="w-[18px] h-[18px]" />}>
            <strong className="font-semibold">승인이 완료되어 시스템에 반영 중입니다.</strong>{' '}
            평균 5분 내외 소요됩니다.
          </StepBanner>
          {state.status === 'loading' && <LoadingState label="연동 대상을 불러오는 중..." />}
          {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
          {state.status === 'ready' && (
            <IdcResourceTable resources={state.resources} cols={['src', 'excl']} />
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
