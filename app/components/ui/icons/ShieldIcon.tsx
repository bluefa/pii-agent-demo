import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * Intent: access permission, with no verdict on it yet.
 *
 * The same shield outline as `ShieldCheckIcon`, minus the check — a shield with a
 * tick inside says "verified", which is the opposite of what an empty
 * permission list means. Drawn at 1.5 rather than that badge's 2.2: this one is
 * an empty-state mark at 40px, not a 16px glyph beside a label.
 */
export const ShieldIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M12 3 4 6v5c0 4.5 3.2 8.4 8 9.7 4.8-1.3 8-5.2 8-9.7V6l-8-3Z" />
  </svg>
);
