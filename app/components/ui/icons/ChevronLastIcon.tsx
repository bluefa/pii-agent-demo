import type { IconProps } from '@/app/components/ui/icons/types';

export const ChevronLastIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M3.25 3.5L6.75 7L3.25 10.5" />
    <path d="M7.25 3.5L10.75 7L7.25 10.5" />
  </svg>
);
