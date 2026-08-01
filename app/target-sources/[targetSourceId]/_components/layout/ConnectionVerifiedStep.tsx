'use client';

import { useCallback, useState, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject, updateTestConnectionConfirmation } from '@/app/lib/api';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { ConfirmedIntegrationDataProvider } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';

interface ConnectionVerifiedStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action?: ReactNode;
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
      toast.error(err instanceof Error ? err.message : '연결 재확인 요청에 실패했습니다.');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={idcStyles.triggerBtn.linkWarn}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        연결 재확인
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => (rollingBack ? undefined : setConfirmKind(null))}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export const ConnectionVerifiedStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: ConnectionVerifiedStepProps) => {

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
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        {/* Same left-aligned stack as steps 2·3: step tag, title + status, guidance copy. */}
        <header className={cardStyles.header}>
          {/* Step position, matching INSTALL_STEPS order in InstallationProcessProgressBar. */}
          <span
            className={cn(
              'mb-1.5 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold',
              primaryColors.bgLight,
              primaryColors.textOnLight,
            )}
          >
            6번째 단계
          </span>
          {/* The step tag sits on its own row above, so the title and the action share one
              centered row — the text-weight action lines up with the title, not with the tag. */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className={cardStyles.cardTitle}>완료 여부 관리자 승인 대기</h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  statusColors.warning.bg,
                  statusColors.warning.textDark,
                )}
              >
                승인 대기
              </span>
            </div>
            {/* C-3: auxiliary retest action pinned to the header right. When to press it is
                explained in the guidance copy below, not in a caption under the button. */}
            <div className="shrink-0">
              <ConnectionVerifiedRetestButton
                targetSourceId={project.targetSourceId}
                onRolledBack={refreshProject}
              />
            </div>
          </div>
          {/* One sentence instead of two: the header subtitle and the info banner said the same
              thing. Blue marks the status clause only, matching steps 2·3. */}
          <p className={cn('mt-3 text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
            <strong className={cn('font-semibold', primaryColors.text)}>
              최종 관리자 승인을 기다리고 있어요.
            </strong>{' '}
            PII Agent 운영팀의 승인이 완료되면 모니터링이 즉시 시작됩니다.
          </p>
          {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (step 2 문법). */}
          <p className={cn('text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
            통합 테스트 결과가 잘못됐거나 연결 테스트를 한 번 더 수행하고 싶다면 우측 상단{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>연결 재확인</strong>을
            눌러주세요.
          </p>
        </header>
        <div className="px-6 pb-6">
          <ConfirmedResourcesSlot bare />
        </div>
      </section>
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
