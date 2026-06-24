'use client';

import { ProcessStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/date';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
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
import { getIdcApprovedResources } from '@/app/lib/api/idc';
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

  // Step 3 source: the approved list (approved-integration).
  const { state } = useIdcResources(project.targetSourceId, getIdcApprovedResources);

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
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다.
              {' · '}승인일시{' '}
              <strong className={cn('font-semibold', textColors.secondary)}>
                {project.approvedAt ? formatDate(project.approvedAt, 'datetime') : '2026-05-09 09:12'}
              </strong>
              {' · '}승인자{' '}
              <strong className={cn('font-semibold', textColors.secondary)}>
                김보안 (kim.security)
              </strong>
            </p>
          </div>
          <span className={cn(idcStyles.status.base, 'text-[12px]', idcStyles.status.partial.text)}>
            <span className={cn(idcStyles.status.dot, idcStyles.status.partial.dot)} />
            반영중
          </span>
        </header>
        <div className="p-6">
          <StepBanner variant="success" icon={<CheckIcon className="w-[18px] h-[18px]" />}>
            <strong className="font-bold">승인이 완료되어 시스템에 반영 중입니다.</strong>{' '}
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
