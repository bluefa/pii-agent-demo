import type { IconProps } from '@/app/components/ui/icons/types';

export const LockIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <rect x="3.25" y="7" width="9.5" height="6.25" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
  </svg>
);
