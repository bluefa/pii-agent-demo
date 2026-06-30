'use client';

import { useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
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
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getIdcConfirmedResources } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

/** 인프라 변경 / 연결 테스트 재실행 — open the confirm-rewind modal (mirror cloud siblings). */
const CompleteActions = () => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);

  // v16 confirmStepProceed rewinds the stepper; the rewind endpoint is not in the
  // contract yet, so confirming surfaces a placeholder until the BFF wires it.
  const handleConfirm = (kind: ConfirmRewindKind) => {
    setConfirmKind(null);
    toast.info(
      kind === 'infra'
        ? '인프라 변경(1단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.'
        : '연결 테스트 재실행(5단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.',
    );
  };

  return (
    <div className="mb-3 flex justify-end gap-2">
      <button type="button" className={idcStyles.triggerBtn.warnOutline} onClick={() => setConfirmKind('infra')}>
        <EditIcon className="w-3.5 h-3.5" />
        인프라 변경
      </button>
      <button type="button" className={idcStyles.triggerBtn.warnOutline} onClick={() => setConfirmKind('retest')}>
        <ReloadIcon className="w-3.5 h-3.5" />
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

  // Step 7 source: the confirmed list (confirmed-integration), same as cloud steps 4–7.
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
            <h2 className={cardStyles.cardTitle}>PII 모니터링 모듈 연동 완료</h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              PII가 사용되어 있을 가능성이 있어요. 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.
            </p>
          </div>
          {/* No per-target health API source — render a neutral em-dash instead
              of a fabricated green "Healthy" pill (B.6). */}
          <span className={cn('text-[12px]', textColors.quaternary)}>—</span>
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
