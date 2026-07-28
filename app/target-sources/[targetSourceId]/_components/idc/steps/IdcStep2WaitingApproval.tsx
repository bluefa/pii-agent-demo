'use client';

import { useEffect, useState } from 'react';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
import { ClockIcon } from '@/app/components/ui/icons';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ErrorState } from '@/app/components/ui/state';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import {
  CardActionBar,
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCancelButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { AppError } from '@/lib/errors';
import { getApprovalRequestLatest, getProject } from '@/app/lib/api';
import { getIdcApprovalRequestResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

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

  // Step 2 source: the requested list via approved-integration, not previous-request.
  const { state } = useIdcResources(project.targetSourceId, getIdcApprovalRequestResources);

  // Integration-unavailable verdict — the table source (approved-integration) omits it,
  // so read approval-requests/latest separately for the verdict + reason.
  const [unavailable, setUnavailable] = useState<{ reason: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getApprovalRequestLatest(project.targetSourceId, { signal: controller.signal })
      .then((res) => {
        setUnavailable(
          res.result?.status === 'UNAVAILABLE' ? { reason: res.result?.reason ?? '' } : null,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && (error.code === 'ABORTED' || error.code === 'NOT_FOUND')) return;
        // Non-fatal: leave the verdict unset and let the normal waiting card render.
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
      {unavailable ? (
        <ApprovalUnavailableCard
          targetSourceId={project.targetSourceId}
          reason={unavailable.reason}
          onReselected={async () => onProjectUpdate(await getProject(project.targetSourceId))}
        />
      ) : (
      // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
      <section className={cardStyles.base}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <h2 className={cardStyles.cardTitle}>연동 대상 승인 대기</h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              요청하신 DB 목록을 관리자가 확인하고 있어요.
            </p>
          </div>
          <span className={cn(idcStyles.status.base, 'text-[12px]', idcStyles.status.partial.text)}>
            <span className={cn(idcStyles.status.dot, idcStyles.status.partial.dot)} />
            승인 대기
          </span>
        </header>
        <div className="p-6">
          <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
            <strong className="font-semibold">관리자 승인을 기다리고 있어요.</strong>{' '}
            평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
          </StepBanner>
          {state.status === 'loading' && <ResourceTableSkeleton />}
          {state.status === 'error' && (
            <ErrorState message="연동 대상을 불러오지 못했습니다." />
          )}
          {state.status === 'ready' && (
            <IdcResourceTable resources={state.resources} cols={['src', 'excl']} />
          )}
        </div>
        {/* C-2 action zone: cancel docks (sticky) at the card bottom. */}
        <CardActionBar>
          <WaitingApprovalCancelButton
            targetSourceId={project.targetSourceId}
            onSuccess={async () => onProjectUpdate(await getProject(project.targetSourceId))}
          />
        </CardActionBar>
      </section>
      )}
      <RejectionAlert project={project} />
    </>
  );
};
