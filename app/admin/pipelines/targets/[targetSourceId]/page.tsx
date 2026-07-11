'use client';

/**
 * Target detail route (C2-a). The view reads `useSearchParams` (nav-context), so
 * it sits under a Suspense boundary per the App Router requirement.
 */
import { Suspense } from 'react';
import { TargetDetailView } from '@/app/admin/pipelines/targets/[targetSourceId]/_components/TargetDetailView';

export default function TargetDetailPage() {
  return (
    <Suspense>
      <TargetDetailView />
    </Suspense>
  );
}
