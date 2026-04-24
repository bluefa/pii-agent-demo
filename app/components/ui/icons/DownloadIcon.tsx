import type { IconProps } from './types';

export const DownloadIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M8 2v8m0 0L5 7m3 3l3-3" strokeLinejoin="round" />
    <path d="M3 12h10" />
  </svg>
);
