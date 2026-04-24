import type { IconProps } from './types';

export const FilterIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M2 3.5h10M4 7h6M5.5 10.5h3" />
  </svg>
);
