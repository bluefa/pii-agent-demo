import type { IconProps } from './types';

export const PlayIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
