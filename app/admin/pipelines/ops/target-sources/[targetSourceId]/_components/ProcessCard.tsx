'use client';

/** 현재 Process card (Figma 4:235) — the 7-step rail + current-step caption. */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { OpsProcessRail } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsProcessRail';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface ProcessCardProps {
  status: ProcessStatus;
}

export function ProcessCard({ status }: ProcessCardProps): ReactElement {
  const step = STEP[status];
  return (
    <section className={pipelineStyles.card.base} aria-label="현재 Process">
      <h2 className={opsStyles.cardTitle}>현재 Process</h2>
      <div className="mt-5">
        <OpsProcessRail status={status} />
      </div>
      <p className={cn(pipelineStyles.text.meta, 'mt-3')}>
        현재{' '}
        <strong className="font-bold text-[var(--pl-text-medium)]">
          {step.n}단계 · {step.label}
        </strong>{' '}
        입니다.
      </p>
    </section>
  );
}
