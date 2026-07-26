'use client';

/** 현재 Process card (Figma 4:235) — the 7-step rail + current-step caption. */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ProcessProgressBar, type ProgressBarStep } from '@/app/components/features/process-status/ProcessProgressBar';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const ORDER: readonly ProcessStatus[] = [
  'IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED',
];

const toSteps = (current: ProcessStatus): ProgressBarStep[] => {
  const currentIndex = ORDER.indexOf(current);
  return ORDER.map((status, index) => ({
    id: status,
    label: STEP[status].label,
    state:
      index < currentIndex || (index === currentIndex && index === ORDER.length - 1)
        ? 'completed'
        : index === currentIndex
          ? 'current'
          : 'pending',
  }));
};

export interface ProcessCardProps {
  status: ProcessStatus;
}

export function ProcessCard({ status }: ProcessCardProps): ReactElement {
  const step = STEP[status];
  return (
    <section className={pipelineStyles.card.base} aria-label="현재 Process">
      <h2 className={opsStyles.cardTitle}>현재 Process</h2>
      <div className="mt-4">
        <ProcessProgressBar steps={toSteps(status)} ariaLabel="설치 진행 단계" />
      </div>
      <p className={cn(pipelineStyles.text.meta, 'mt-3')}>
        현재{' '}
        <strong className="font-bold text-[var(--pl-text-medium)]">
          Step {step.n} · {step.label}
        </strong>{' '}
        단계입니다.
      </p>
    </section>
  );
}
