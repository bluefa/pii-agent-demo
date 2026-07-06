'use client';

import { CloudTargetSource } from '@/lib/types';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { cardStyles, cn } from '@/lib/theme';

interface ProcessStatusCardProps {
  project: CloudTargetSource;
}

// Pure display: renders the progress bar from the project's current step.
// Status transitions surface on the user's next refresh (no polling).
export const ProcessStatusCard = ({ project }: ProcessStatusCardProps) => {
  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cardStyles.header}>
        <h2 className={cardStyles.cardTitle}>프로세스 진행 상태</h2>
      </header>

      <div className={cardStyles.body}>
        <InstallationProcessProgressBar currentStep={project.processStatus} />
      </div>
    </section>
  );
};
