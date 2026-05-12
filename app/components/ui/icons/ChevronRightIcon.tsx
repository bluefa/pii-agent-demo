import type { IconProps } from '@/app/components/ui/icons/types';

export const ChevronRightIcon = ({ className, ...rest }: IconProps) => (
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
    <path d="M5.25 3.5L8.75 7L5.25 10.5" />
  </svg>
);
