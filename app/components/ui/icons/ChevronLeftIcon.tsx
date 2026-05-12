import type { IconProps } from '@/app/components/ui/icons/types';

export const ChevronLeftIcon = ({ className, ...rest }: IconProps) => (
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
    <path d="M8.75 3.5L5.25 7L8.75 10.5" />
  </svg>
);
