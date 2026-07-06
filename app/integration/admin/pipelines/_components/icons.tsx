/**
 * LIN-25 pipeline icon set — the 13 inline SVG symbols used by the prototype
 * (design/pipeline/admin-pipeline.html `<defs>`), ported as a single typed
 * <Icon> component. Stroke geometry is copied verbatim; the prototype's unused
 * symbols (i-refresh/i-arrow-r/i-play/i-circle/i-circle-dot/i-info) are omitted.
 *
 * Sizes: 16 default / 14 'sm' / 22 'lg' (the 'lg' glyph sits inside the 40px
 * empty-state circle — the box is PlEmptyState's, not the icon's).
 */
import type { ReactElement } from 'react';

export type IconName =
  | 'search'
  | 'chev-l'
  | 'chev-r'
  | 'check'
  | 'x'
  | 'ban'
  | 'inbox'
  | 'compass'
  | 'cursor'
  | 'clock'
  | 'cloud'
  | 'arrow-ur'
  | 'flow';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<IconSize, number> = { sm: 14, md: 16, lg: 22 };

/** Symbol path geometry (viewBox 0 0 24 24), stroked with currentColor. */
const ICON_PATHS: Record<IconName, ReactElement> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </>
  ),
  'chev-l': <path d="M15 18.5 8.5 12 15 5.5" />,
  'chev-r': <path d="m9 5.5 6.5 6.5L9 18.5" />,
  check: <path d="m4.5 12.5 5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.5 6.5 11 11" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.4 5h13.2L22 12v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.3 5.2-5.2 2.3 2.3-5.2z" />
    </>
  ),
  cursor: <path d="m5 3 7.5 17 2-7.5L22 10.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l2.8 1.8" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.62-1.46A4.5 4.5 0 0 1 17.5 18H7Z" />,
  'arrow-ur': (
    <>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </>
  ),
  flow: (
    <>
      <circle cx="4.5" cy="12" r="2.3" />
      <circle cx="12" cy="12" r="2.3" />
      <circle cx="19.5" cy="12" r="2.3" />
      <path d="M6.8 12h2.9m4.6 0h2.9" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  /** 'sm' 14 · 'md' 16 (default) · 'lg' 22. */
  size?: IconSize;
  className?: string;
  /** Accessible label; when omitted the icon is aria-hidden (decorative). */
  title?: string;
}

export function Icon({ name, size = 'md', className, title }: IconProps): ReactElement {
  const px = SIZE_PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {ICON_PATHS[name]}
    </svg>
  );
}
