/**
 * Guide CMS — loading placeholder.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 4.5.
 *
 * `aria-busy` + `aria-live=polite` lets assistive tech announce the
 * pending state without stealing focus. Visual bars use translucent
 * black to ride on top of the warm variant tint rather than a raw color.
 */

import { cardStyles, cn } from '@/lib/theme';

export const GuideCardSkeleton = () => (
  <div
    aria-busy="true"
    aria-live="polite"
    className={cn(
      'rounded-xl border shadow-sm overflow-hidden animate-pulse',
      cardStyles.warmVariant.container,
    )}
  >
    <div className="h-10 border-b border-black/5 bg-black/5" />
    <div className="px-6 py-5 space-y-3">
      <div className="h-4 w-3/4 rounded bg-black/10" />
      <div className="h-4 w-5/6 rounded bg-black/10" />
      <div className="h-4 w-2/3 rounded bg-black/10" />
    </div>
  </div>
);
