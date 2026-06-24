'use client';

import { useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
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
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getIdcConfirmedResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

/** 연결 테스트 재실행 — opens the confirm-rewind modal (mirrors cloud siblings). */
const ConnectionVerifiedRetestButton = () => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);

  // v16 opens the confirm-rewind modal; the rewind endpoint is not in the contract
  // yet, so confirming surfaces a placeholder until the BFF wires it.
  const handleConfirm = () => {
    setConfirmKind(null);
    toast.info('연결 테스트 재실행(5단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.');
  };

  return (
    <div className="flex justify-end mt-4">
      <button
        type="button"
        className={idcStyles.triggerBtn.warnOutline}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        연결 테스트 재실행
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

/**
 * IDC Step 6 — 완료 여부 관리자 승인 대기 (read-only).
 * Chrome + read-only IdcResourceTable (cols `src`, `credro`, `conn`; integration targets only).
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

  // Step 6 source: the confirmed list (confirmed-integration), same as cloud steps 4–7.
  const { state } = useIdcResources(project.targetSourceId, getIdcConfirmedResources);

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
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다.
            </p>
          </div>
          <span className={cn(idcStyles.status.base, 'text-[12px]', idcStyles.status.partial.text)}>
            <span className={cn(idcStyles.status.dot, idcStyles.status.partial.dot)} />
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
            <IdcResourceTable resources={state.resources} cols={['src', 'credro', 'conn']} />
          )}
          <ConnectionVerifiedRetestButton />
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
