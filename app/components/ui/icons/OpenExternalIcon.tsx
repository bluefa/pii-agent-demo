import type { IconProps } from './types';

/**
 * Intent: opens a link in a new tab / external destination (Jira, docs, etc.).
 * Glyph is an arrow-out-of-box; name is intent-based per anti-pattern H2.
 */
export const OpenExternalIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
