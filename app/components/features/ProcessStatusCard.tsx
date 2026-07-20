'use client';

import { CloudTargetSource } from '@/lib/types';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { cardStyles, cn } from '@/lib/theme';

interface ProcessStatusCardProps {
  project: CloudTargetSource;
}

// Pure display: renders the progress bar from the project's current step.
// Status transitions surface on the user's next refresh (no polling).
// Compact strip (UX report B): the stepper is self-describing, so no card
// title/header — visible label removed in favor of aria-label.
export const ProcessStatusCard = ({ project }: ProcessStatusCardProps) => {
  return (
    <section
      aria-label="프로세스 진행 상태"
      className={cn(cardStyles.base, 'overflow-hidden px-[28px] py-[16px]')}
    >
      <InstallationProcessProgressBar currentStep={project.processStatus} />
    </section>
  );
};
