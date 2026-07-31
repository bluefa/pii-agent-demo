import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * Intent: a forward jump to another in-app screen (vs OpenExternalIcon's out-of-box glyph,
 * which promises a new tab / external destination).
 */
export const ArrowUpRightIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);
