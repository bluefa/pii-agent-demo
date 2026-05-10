'use client';

import { ProcessStatus } from '@/lib/types';
import {
  ProcessProgressBar,
  type ProgressBarStep,
} from '@/app/components/features/process-status/ProcessProgressBar';

const INSTALL_STEPS = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 DB 선택' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '연동 대상 승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동 대상 반영중' },
  { step: ProcessStatus.INSTALLING, label: 'Agent 설치' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '관리자 승인 대기' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
] as const;

const toSteps = (currentStep: ProcessStatus): ProgressBarStep[] =>
  INSTALL_STEPS.map((it, idx) => {
    const isCompleted = currentStep > it.step;
    const isCurrent = currentStep === it.step;
    const isLast = idx === INSTALL_STEPS.length - 1;
    return {
      id: String(it.step),
      label: it.label,
      state:
        isCompleted || (isCurrent && isLast)
          ? 'completed'
          : isCurrent
            ? 'current'
            : 'pending',
    };
  });

interface InstallationProcessProgressBarProps {
  currentStep: ProcessStatus;
}

export const InstallationProcessProgressBar = ({
  currentStep,
}: InstallationProcessProgressBarProps) => (
  <ProcessProgressBar
    steps={toSteps(currentStep)}
    ariaLabel="설치 진행 단계"
  />
);
