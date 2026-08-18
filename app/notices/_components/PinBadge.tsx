import { cn, primaryColors } from '@/lib/theme';

/**
 * "고정" marker.
 *
 * The pin is drawn as a filled silhouette rather than a stroked outline: at
 * 12px a 2px-stroke pin has more ink than gap, so the strokes merge into a
 * blob and the colour reads as a smear. A filled shape keeps one solid edge.
 */
export const PinBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
      primaryColors.bgLight,
      primaryColors.textOnLight,
      className,
    )}
  >
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3" fill="currentColor">
      <path d="M9.7 1.3a1 1 0 0 1 1.4 0l3.6 3.6a1 1 0 0 1 0 1.4l-.5.5a2.5 2.5 0 0 1-2.8.5l-1.7 1.7.2 2.3a1 1 0 0 1-.3.8l-.7.7a1 1 0 0 1-1.4 0L4.9 10.5l-3.2 3.2a.7.7 0 0 1-1-1l3.2-3.2L1.3 7a1 1 0 0 1 0-1.4l.7-.7a1 1 0 0 1 .8-.3l2.3.2 1.7-1.7a2.5 2.5 0 0 1 .5-2.8l.4-.5Z" />
    </svg>
    고정
  </span>
);
