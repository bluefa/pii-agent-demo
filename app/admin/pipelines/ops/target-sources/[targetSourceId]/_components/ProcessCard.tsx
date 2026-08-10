'use client';

/**
 * 현재 Process card (Figma 4:235) — the 7-step rail.
 *
 * No caption under the rail: it said "현재 5단계 · 연결 테스트 입니다" while the rail
 * already draws that number in the current circle and that label in blue beneath
 * it, and the masthead pill names it a third time one screen above. The rail now
 * carries `aria-current` so dropping the sentence costs screen readers nothing.
 */
import type { ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { OpsProcessRail } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsProcessRail';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface ProcessCardProps {
  status: ProcessStatus;
}

export function ProcessCard({ status }: ProcessCardProps): ReactElement {
  return (
    <section className={pipelineStyles.card.base} aria-label="현재 Process">
      <h2 className={opsStyles.cardTitle}>현재 Process</h2>
      <div className="mt-5">
        <OpsProcessRail status={status} />
      </div>
    </section>
  );
}
