import type { IconProps } from '@/app/components/ui/icons/types';

export interface SortCaretIconProps extends IconProps {
  /** Which direction the column is currently sorted in — `null` while unsorted. */
  active?: 'asc' | 'desc' | null;
}

/**
 * Two-state sort caret for a sortable column head: both triangles are always
 * drawn, and the active direction is the opaque one.
 *
 * Colour comes from `currentColor` so the glyph reads as part of its own header
 * label rather than as a second ink. The idle triangle is the same colour at low
 * alpha — one hue, two weights — so a change of header colour cannot leave the
 * two halves in different families.
 */
export const SortCaretIcon = ({ className, active = null, ...rest }: SortCaretIconProps) => (
  <svg
    className={className}
    width="8"
    height="12"
    viewBox="0 0 8 12"
    fill="currentColor"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M4 1 7 5H1z" fillOpacity={active === 'asc' ? 1 : 0.35} />
    <path d="M4 11 1 7h6z" fillOpacity={active === 'desc' ? 1 : 0.35} />
  </svg>
);
