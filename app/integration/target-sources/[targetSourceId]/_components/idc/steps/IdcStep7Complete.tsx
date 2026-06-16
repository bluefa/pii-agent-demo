'use client';

import { useEffect, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles, statusColors, textColors } from '@/lib/theme';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/integration/target-sources/[targetSourceId]/_components/common/warning-outline-button';
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

/** 인프라 변경 / 연결 테스트 재실행 — intentionally toast stubs (mirror cloud siblings). */
const CompleteActions = () => {
  const toast = useToast();
  const stub = (label: string) => () => toast.info(`${label} 기능 준비중입니다.`);
  return (
    <div className="mb-3 flex justify-end gap-2">
      <button type="button" className={WARNING_OUTLINE_BUTTON_CLASS} onClick={stub('인프라 변경')}>
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </button>
      <button type="button" className={WARNING_OUTLINE_BUTTON_CLASS} onClick={stub('연결 테스트 재실행')}>
        <ReloadIcon className="w-3.5 h-3.5" />
        연결 테스트 재실행
      </button>
    </div>
  );
};

/**
 * IDC Step 7 — PII 모니터링 모듈 연동 완료 (read-only).
 * Chrome + Healthy pill + 인프라 변경/연결 테스트 재실행 actions + read-only
 * IdcResourceTable (cols `src`, `health`; integration targets only).
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep7Complete = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.INSTALLATION_COMPLETE);

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
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <h2 className={cardStyles.cardTitle}>PII 모니터링 모듈 연동 완료</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              PII가 사용되어 있을 가능성이 있어요. 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
            </p>
          </div>
          <span className={cn(idcStyles.statusPill, statusColors.success.bg, statusColors.success.textDark)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.success.dot)} />
            Healthy
          </span>
        </header>
        <div className="p-6">
          <CompleteActions />
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
            <IdcResourceTable resources={state.resources} cols={['src', 'health']} />
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
