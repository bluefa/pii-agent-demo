'use client';

import { StepBanner } from '@/app/components/ui/StepBanner';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { invalidationLines } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import type { SduInvalidation } from '@/lib/types/sdu';

export interface InvalidationBannerProps {
  invalidation: SduInvalidation;
}

/**
 * What the last trip to 1단계 changed, told once.
 *
 * Coming back does NOT restart Step 4 — every answer is stored per Region, so what survives
 * an edit is computed rather than discarded. This banner is the only place that difference is
 * spoken; without it the owner reads a half-answered block as a bug.
 */
export const InvalidationBanner = ({ invalidation }: InvalidationBannerProps) => {
  const lines = invalidationLines(invalidation);
  if (lines.length === 0) return null;

  return (
    <StepBanner variant="warn" icon={<StatusWarningIcon className="h-5 w-5" />}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </StepBanner>
  );
};
