import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 가이드 — 전구.
 *
 * Path is the owner's Figma node verbatim (`slrqFgziqlHznBZ1VMPtcq`, `6:11`,
 * 오너 지시 2026-08-23), so ⛔ do not "tidy" the coordinates — they are the design.
 *
 * ⚠️ `viewBox="0 0 14 14"`, not the 24 every other icon here uses. The stroke is 2 at
 * that box, i.e. a 1:7 stroke-to-box ratio against Heroicons' 1:12 — a noticeably
 * chunkier glyph, and that chunk is the point. Rescaling the path into a 24 box would
 * have to thin the stroke to 3.43 to keep the ratio, which is not a value anyone would
 * read back as "the Figma spec". Callers size it with `h-*`/`w-*` as usual.
 *
 * Stroked, not filled — it was briefly a Heroicons solid bulb, and the Figma spec that
 * replaced it is an outline. `currentColor`, so the caller owns the ink: both call sites
 * take it from `railStyles.zoneMark`, at the same 20px.
 *
 * ⛔ The Figma node also has a 28×28 #FFF8E1 plate behind this. It is deliberately not
 * rendered — the folded strip's bare mark is the standard (오너 지시 2026-08-23), and a
 * mark that changes shape when the rail folds is two marks.
 */
export const GuideIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M8.75 8.16676C8.86667 7.58338 9.15833 7.17501 9.625 6.70831C10.2083 6.18327 10.5 5.42487 10.5 4.66648C10.5 3.73815 10.1313 2.84784 9.47487 2.19141C8.8185 1.53498 7.92826 1.1662 7 1.1662C6.07174 1.1662 5.1815 1.53498 4.52513 2.19141C3.86875 2.84784 3.5 3.73815 3.5 4.66648C3.5 5.24986 3.61667 5.94992 4.375 6.70831C4.78333 7.11668 5.13333 7.58338 5.25 8.16676M5.25 10.5003H8.75M5.83333 12.8338H8.16667" />
  </svg>
);
