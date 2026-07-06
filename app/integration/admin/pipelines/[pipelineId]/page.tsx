'use client';

/**
 * Pipeline detail route (C2-b). The view reads `useSearchParams` (nav-context),
 * so it sits under a Suspense boundary per the App Router requirement.
 */
import { Suspense } from 'react';
import { PipelineDetailView } from '@/app/integration/admin/pipelines/[pipelineId]/_components/PipelineDetailView';

export default function PipelineDetailPage() {
  return (
    <Suspense>
      <PipelineDetailView />
    </Suspense>
  );
}
