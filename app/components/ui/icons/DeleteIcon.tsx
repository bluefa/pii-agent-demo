import type { IconProps } from './types';

/**
 * Intent: destructive deletion action (인프라 삭제, row 삭제 등).
 * Glyph is a trash can; name is intent-based per anti-pattern H2.
 */
export const DeleteIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
