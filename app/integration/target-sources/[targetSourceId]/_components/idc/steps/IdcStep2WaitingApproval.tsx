'use client';

import { useEffect, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles, statusColors, textColors } from '@/lib/theme';
import { ClockIcon } from '@/app/components/ui/icons';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCancelButton } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getProject } from '@/app/lib/api';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';

type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

/**
 * IDC Step 2 — 연동 대상 승인 대기 (read-only).
 * Chrome + read-only IdcResourceTable (cols `src`, `excl`; excluded rows shown).
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep2WaitingApproval = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.WAITING_APPROVAL);

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });

  // Target-switch safety: the IDC subtree is keyed by targetSourceId (DR2 remount),
  // so this effect runs once per mount; the AbortController guards the late
  // response if the component unmounts mid-flight (DR3).
  useEffect(() => {
    const controller = new AbortController();

    void getIdcResources(project.targetSourceId, { signal: controller.signal })
      .then((resources) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', resources });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof AppError && error.code === 'ABORTED')) return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [project.targetSourceId]);

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
            <h2 className={cardStyles.cardTitle}>연동 대상 승인 대기</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              요청하신 DB 목록을 관리자가 확인하고 있어요.
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
            승인 대기
          </span>
        </header>
        <div className="p-6">
          <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
            <strong className="font-semibold">관리자 승인을 기다리고 있어요.</strong>{' '}
            평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
          </StepBanner>
          {state.status === 'loading' && (
            <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
              연동 대상을 불러오는 중...
            </div>
          )}
          {state.status === 'error' && (
            <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
              연동 대상을 불러오지 못했습니다.
            </div>
          )}
          {state.status === 'ready' && (
            <IdcResourceTable resources={state.resources} cols={['src', 'excl']} />
          )}
          <div className="mt-4 flex justify-end">
            <WaitingApprovalCancelButton
              targetSourceId={project.targetSourceId}
              onSuccess={async () => onProjectUpdate(await getProject(project.targetSourceId))}
            />
          </div>
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
