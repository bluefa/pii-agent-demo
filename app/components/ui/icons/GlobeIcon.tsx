import type { IconProps } from '@/app/components/ui/icons/types';

/** Intent: language / locale switch. */
export const GlobeIcon = ({ className, ...rest }: IconProps) => (
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
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a13.5 13.5 0 0 1 0 18a13.5 13.5 0 0 1 0-18" />
  </svg>
);
