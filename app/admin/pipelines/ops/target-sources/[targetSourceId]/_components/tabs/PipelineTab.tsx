'use client';

/**
 * 인프라 작업 tab — Terraform 상태 card on top of the SAME 현재 작업 + 작업 이력
 * experience as the standalone target page (/admin/pipelines/targets/{id}) via
 * the shared TargetPipelineSections (live run-card with 8s polling, start CTA,
 * history).
 */
import type { ReactElement } from 'react';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import { TerraformStatusCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/TerraformStatusCard';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

export interface PipelineTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function PipelineTab({ targetSourceId, detail }: PipelineTabProps): ReactElement {
  return (
    <div>
      <TerraformStatusCard targetSourceId={targetSourceId} />
      <TargetPipelineSections
        targetSourceId={String(targetSourceId)}
        raw={detail}
        firstSectionClassName="mt-11"
      />
    </div>
  );
}
