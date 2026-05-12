import type { IconProps } from '@/app/components/ui/icons/types';

export const ChevronFirstIcon = ({ className, ...rest }: IconProps) => (
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
    <path d="M6.75 3.5L3.25 7L6.75 10.5" />
    <path d="M10.75 3.5L7.25 7L10.75 10.5" />
  </svg>
);
