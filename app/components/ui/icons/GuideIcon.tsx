import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 가이드 — 전구.
 *
 * Solid, not the outline it used to be. Two reasons, both from 오너 지시 2026-08-23:
 * the glyph now carries a colour of its own, and a colour needs an area to sit in — a
 * 2px stroke on a 24 viewBox has almost none. And at the 20px the folded rail gives it,
 * the outline read as a wire drawing rather than as a mark.
 *
 * Path is Heroicons v2 `light-bulb` (solid), transcribed verbatim. The outline it
 * replaces was the v1 counterpart of the same glyph, so the silhouette is unchanged.
 *
 * Fill is `currentColor` — the caller owns the colour, and both call sites take it
 * from `railStyles.zoneMark`.
 */
export const GuideIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M12 .75a8.25 8.25 0 00-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 00.577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.714 6.714 0 01-.937-.171.75.75 0 11.374-1.453 5.261 5.261 0 002.626 0 .75.75 0 11.374 1.452 6.712 6.712 0 01-.937.172v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 00.577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0012 .75z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.013 19.9a.75.75 0 01.877-.597 11.319 11.319 0 004.22 0 .75.75 0 11.28 1.473 12.819 12.819 0 01-4.78 0 .75.75 0 01-.597-.876zM9.754 22.344a.75.75 0 01.824-.668 13.682 13.682 0 002.844 0 .75.75 0 11.156 1.492 15.156 15.156 0 01-3.156 0 .75.75 0 01-.668-.824z"
    />
  </svg>
);
