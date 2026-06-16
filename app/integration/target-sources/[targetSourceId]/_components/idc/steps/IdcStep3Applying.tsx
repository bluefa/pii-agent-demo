'use client';

import { useEffect, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cn, textColors } from '@/lib/theme';
import { Card } from '@/app/components/ui/Card';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';

type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

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

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });

  // Target-switch safety via DR2 remount (keyed subtree) + DR3 AbortController.
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
      <Card title="연동 대상 반영중" padding="none">
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
      </Card>
      <RejectionAlert project={project} />
    </>
  );
};
