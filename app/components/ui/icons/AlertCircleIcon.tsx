import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * Intent: something went wrong with what was asked (exclamation in a circle).
 *
 * ⛔ Not `StatusErrorIcon`, which is an X in a circle — that one says "this thing is
 * failed/off", this one says "read what happened". Same glyph the confirm modals draw.
 */
export const AlertCircleIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12.5" />
    <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
  </svg>
);
