'use client';

import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, statusColors, textColors } from '@/lib/theme';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ClockIcon, ReloadIcon } from '@/app/components/ui/icons';
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

/** 연결 테스트 재실행 — intentionally a toast stub (mirrors cloud siblings). */
const ConnectionVerifiedRetestButton = () => {
  const toast = useToast();
  return (
    <div className="flex justify-end mt-4">
      <button
        type="button"
        className={idcStyles.triggerBtn.warnOutline}
        onClick={() => toast.info('연결 테스트 재실행 기능 준비중입니다.')}
      >
        <ReloadIcon className="w-3.5 h-3.5" />
        연결 테스트 재실행
      </button>
    </div>
  );
};

/**
 * IDC Step 6 — 완료 여부 관리자 승인 대기 (read-only).
 * Chrome + read-only IdcResourceTable (cols `src`, `conn`; integration targets only).
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7)
 * via the shared `useIdcResources` read hook, never module-level state.
 */
export const IdcStep6ConnectionVerified = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.CONNECTION_VERIFIED);

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
            <h2 className={cardStyles.cardTitle}>완료 여부 관리자 승인 대기</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다.
            </p>
          </div>
          <span className={cn(idcStyles.statusPill, statusColors.warning.bg, statusColors.warning.textDark)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
            승인 대기
          </span>
        </header>
        <div className="p-6">
          <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
            <strong className="font-semibold">최종 관리자 승인을 기다리고 있어요.</strong>{' '}
            승인이 완료되면 모니터링이 즉시 시작됩니다.
          </StepBanner>
          {state.status === 'loading' && <LoadingState label="연동 대상을 불러오는 중..." />}
          {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
          {state.status === 'ready' && (
            <IdcResourceTable resources={state.resources} cols={['src', 'conn']} />
          )}
          <ConnectionVerifiedRetestButton />
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
