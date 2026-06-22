'use client';

import { useEffect, useRef, useCallback } from 'react';
import { CloudTargetSource, ProcessStatus } from '@/lib/types';
import { getProcessStatus, getProject } from '@/app/lib/api';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { TIMINGS } from '@/lib/constants/timings';
import { cardStyles, cn } from '@/lib/theme';

interface ProcessStatusCardProps {
  project: CloudTargetSource;
  onProjectUpdate?: (project: CloudTargetSource) => void;
}

export const ProcessStatusCard = ({
  project,
  onProjectUpdate,
}: ProcessStatusCardProps) => {
  const currentStep = project.processStatus;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableOnProjectUpdate = useCallback(
    (p: CloudTargetSource) => onProjectUpdate?.(p),
    [onProjectUpdate],
  );

  useEffect(() => {
    const shouldPoll =
      currentStep === ProcessStatus.WAITING_APPROVAL ||
      currentStep === ProcessStatus.APPLYING_APPROVED;

    if (!shouldPoll || !project.targetSourceId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const expectedBff =
      currentStep === ProcessStatus.WAITING_APPROVAL
        ? 'PENDING'
        : 'CONFIRMING';

    const poll = async () => {
      try {
        const status = await getProcessStatus(project.targetSourceId);
        if (status.process_status !== expectedBff) {
          const updated = await getProject(project.targetSourceId);
          stableOnProjectUpdate(updated as CloudTargetSource);
        }
      } catch {
        // polling failure ignored
      }
    };

    poll();

    pollRef.current = setInterval(poll, TIMINGS.PROCESS_STATUS_POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentStep, project.targetSourceId, stableOnProjectUpdate]);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cardStyles.header}>
        <h2 className={cardStyles.cardTitle}>프로세스 진행 상태</h2>
      </header>

      <div className={cardStyles.body}>
        <InstallationProcessProgressBar currentStep={currentStep} />
      </div>
    </section>
  );
};
