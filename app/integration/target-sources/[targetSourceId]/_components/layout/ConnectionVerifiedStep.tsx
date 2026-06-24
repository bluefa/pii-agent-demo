'use client';

import { useCallback, useState, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject, updateTestConnectionConfirmation } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ClockIcon, ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/integration/target-sources/[targetSourceId]/_components/common/warning-outline-button';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface ConnectionVerifiedStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const ConnectionVerifiedRetestButton = ({
  targetSourceId,
  onRolledBack,
}: {
  targetSourceId: number;
  onRolledBack: () => Promise<void>;
}) => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // 되돌아가기 rolls back the completion acknowledgment (confirmed:false), which moves the
  // process status back to step 5; awaiting onRolledBack (getProject + onProjectUpdate)
  // ensures the UI transitions to the rewound step before the spinner clears.
  const handleConfirm = async () => {
    if (rollingBack) return;
    setRollingBack(true);
    try {
      await updateTestConnectionConfirmation(targetSourceId, false);
      setConfirmKind(null);
      await onRolledBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '연결 테스트 재실행 요청에 실패했습니다.');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="flex justify-end mt-4">
      <button
        type="button"
        className={WARNING_OUTLINE_BUTTON_CLASS}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        연결 테스트 재실행
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => (rollingBack ? undefined : setConfirmKind(null))}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export const ConnectionVerifiedStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: ConnectionVerifiedStepProps) => {
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    project.processStatus,
    project.awsInstallationMode,
  );

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
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
            <h2 className={cardStyles.cardTitle}>
              완료 여부 관리자 승인 대기
            </h2>
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
            <strong className="font-semibold">최종 관리자 승인을 기다리고 있어요.</strong>
            {' '}승인이 완료되면 모니터링이 즉시 시작됩니다.
          </StepBanner>
          <ConfirmedResourcesSlot bare />
          <ConnectionVerifiedRetestButton
            targetSourceId={project.targetSourceId}
            onRolledBack={refreshProject}
          />
        </div>
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
