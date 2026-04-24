import type { IconProps } from './types';

export const ChevronDownIcon = ({ className, ...rest }: IconProps) => (
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
    <path d="M3.5 5.25L7 8.75L10.5 5.25" />
  </svg>
);
