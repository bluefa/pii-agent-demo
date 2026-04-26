'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CloudTargetSource, ProcessStatus } from '@/lib/types';
import { getProcessStatus, getProject } from '@/app/lib/api';
import { StepProgressBar } from './process-status';
import { ProjectHistoryPanel } from './history';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, primaryColors, interactiveColors } from '@/lib/theme';

type ProcessTabType = 'status' | 'history';

const TABS: { id: ProcessTabType; label: string }[] = [
  { id: 'status', label: '프로세스 진행 상태' },
  { id: 'history', label: '진행 내역' },
];

interface ProcessStatusCardProps {
  project: CloudTargetSource;
  onProjectUpdate?: (project: CloudTargetSource) => void;
}

export const ProcessStatusCard = ({
  project,
  onProjectUpdate,
}: ProcessStatusCardProps) => {
  const [activeTab, setActiveTab] = useState<ProcessTabType>('status');

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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="border-b border-gray-200">
        <nav className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? `${primaryColors.border} ${primaryColors.text}`
                  : interactiveColors.inactiveTab
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {activeTab === 'status' && <StepProgressBar currentStep={currentStep} />}

        {activeTab === 'history' && (
          <ProjectHistoryPanel targetSourceId={project.targetSourceId} embedded />
        )}
      </div>
    </div>
  );
};
