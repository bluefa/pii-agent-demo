'use client';

import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, statusColors, textColors } from '@/lib/theme';
import { EditIcon, ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
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

/** 인프라 변경 / 연결 테스트 재실행 — intentionally toast stubs (mirror cloud siblings). */
const CompleteActions = () => {
  const toast = useToast();
  const stub = (label: string) => () => toast.info(`${label} 기능 준비중입니다.`);
  return (
    <div className="mb-3 flex justify-end gap-2">
      <button type="button" className={idcStyles.triggerBtn.warnOutline} onClick={stub('인프라 변경')}>
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </button>
      <button type="button" className={idcStyles.triggerBtn.warnOutline} onClick={stub('연결 테스트 재실행')}>
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
          {state.status === 'loading' && <LoadingState label="연동 대상을 불러오는 중..." />}
          {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
          {state.status === 'ready' && (
            <IdcResourceTable resources={state.resources} cols={['src', 'health']} />
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
