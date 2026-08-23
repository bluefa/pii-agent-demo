'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/ui/icons';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { RAIL_OPEN_MIN_WIDTH, serialiseRailCookie } from '@/lib/rail-preference';
import { cn, railStyles } from '@/lib/theme';

/**
 * `null` = no stored preference. The caller paints its media-query default for that
 * case, which is exactly the markup the server sent.
 */
export type RailCollapsed = boolean | null;

export interface RailCollapse {
  collapsed: RailCollapsed;
  toggle: () => void;
}

/**
 * Fold state for the guide rail, remembered across visits.
 *
 * `initialCollapsed` comes from the SERVER, which read the cookie off the request — so
 * when a preference exists the very first painted frame is already the right width and
 * there is nothing to correct. That is the whole reason this is a cookie: the rail's
 * width is decided during the first paint, and the first paint happens before any client
 * storage can be read. The previous `localStorage` version could only guess from a media
 * query, so a reader who had folded the rail watched it paint open and then snap shut.
 *
 * With no cookie, `initialCollapsed` is `null` and the old three-phase shape still runs:
 * the caller paints the breakpoint default, and the effect below resolves to the same
 * answer, so nothing moves. It exists so `collapsed` stops being `null` once a real value
 * is knowable — a press has to mean "the opposite of what I am looking at".
 *
 * `setTimeout(0)`, not `requestAnimationFrame` — rAF never fires in a background tab, so
 * a page opened in one would sit on `null` until someone looked at it.
 */
export const useRailCollapse = (initialCollapsed: RailCollapsed): RailCollapse => {
  const [collapsed, setCollapsed] = useState<RailCollapsed>(initialCollapsed);

  useEffect(() => {
    // The server already knew; there is nothing for the client to resolve.
    if (initialCollapsed !== null) return;
    const timer = window.setTimeout(
      () => setCollapsed(window.innerWidth < RAIL_OPEN_MIN_WIDTH),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [initialCollapsed]);

  const toggle = useCallback(() => {
    // A press that lands before the effect runs still has to mean "the opposite of what
    // I am looking at", and what the reader is looking at is the width default.
    const next = !(collapsed ?? window.innerWidth < RAIL_OPEN_MIN_WIDTH);
    setCollapsed(next);
    try {
      document.cookie = serialiseRailCookie(next, window.location.protocol === 'https:');
    } catch {
      // Blocked cookies: the fold still works for this visit.
    }
  }, [collapsed]);

  return { collapsed, toggle };
};

interface RailToggleProps {
  /** Which way the glyph points: the direction the rail's edge MOVES when pressed. */
  direction: 'left' | 'right';
  /** What the press does — 「가이드 접기」. This is a glyph-only control, so it is its whole name. */
  label: string;
  /**
   * The control sits on the 협업 채널 band's #E8F1FF rather than the rail's white plane.
   * ⛔ Not cosmetic: the white plane's gray-100 hover measures ~1.03 on that tint, so
   * without this the button silently loses its only hover feedback.
   */
  onTint?: boolean;
  onClick: () => void;
}

/**
 * The fold control.
 *
 * Direction is passed in rather than derived from a collapsed flag because both states
 * can be mounted at the same time: while `collapsed` is still `null` the strip and the
 * open rail each render their own button behind a media query, so neither one is in a
 * position to ask what the current state is.
 */
export const RailToggle = ({ direction, label, onTint, onClick }: RailToggleProps) => {
  const Glyph = direction === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        railStyles.toggleBase,
        onTint ? railStyles.toggleOnTint : railStyles.toggleOnSurface,
      )}
    >
      <Glyph className="h-4 w-4" />
    </button>
  );
};

interface RailEntryProps {
  /** 20px glyph. Reuse the icon that already means this thing elsewhere in the app. */
  icon: ReactNode;
  /**
   * Shown under the glyph. ⛔ One short word — the strip is 56px and the label may not
   * wrap or shrink. Abbreviate rather than shave the type.
   */
  label: string;
  /**
   * The entry's full name AND its state, in words: "협업 채널 — BDCDIP-1353".
   * It is the accessible name, so it must CONTAIN `label` (WCAG 2.5.3) and it must
   * carry whatever the dot says in colour.
   */
  hint: string;
  /**
   * Richer tip content than the `hint` sentence — the panel zone itself, rendered in
   * place so the reader does not have to unfold to read it.
   *
   * Supplying it switches the tip to click-to-pin, because content worth rendering is
   * content worth reaching: a hover tip dies the moment the pointer leaves the trigger,
   * and anything interactive inside it would be unreachable. ⛔ Do not pass a plain
   * sentence here — `hint` already is one, and pinning a sentence just adds a press.
   */
  tip?: ReactNode;
  /** Fill class for the state dot, from `statusColors[tone].dot`. Omit for no dot. */
  dot?: string;
  /**
   * What the press does. Omit when `tip` carries the whole answer — then the press is
   * the pin, and the button is still a real button so Enter/Space reach it.
   */
  onClick?: () => void;
}

/**
 * A named entry on the folded rail.
 *
 * A folded rail that shows only a direction chevron does not say what it puts back —
 * AWS Cloudscape says as much about its own icon-only trigger bar, that identifying
 * which icon opens which panel is a cognitive load that grows with every panel. So the
 * name is on the strip in words, the way JetBrains lets a tool window show its name
 * under the stripe icon, and the tooltip carries what the one-word label had to drop.
 */
export const RailEntry = ({ icon, label, hint, tip, dot, onClick }: RailEntryProps) => (
  <Tooltip
    content={tip ?? hint}
    // `value`, not the dark `status` box: this tip carries a zone of the panel, and the
    // panel is a white surface. The white box with a hairline and a soft shadow reads as
    // that surface lifted off the page — the dark box would read as UI from elsewhere.
    variant="value"
    // Down, not up. The entries sit near the top of a full-height rail, so a tip placed
    // above has to flip anyway; asking for the flip is not a plan.
    position="bottom"
    openOn={tip ? 'click' : 'hover'}
    triggerClassName="w-full"
  >
    <button type="button" onClick={onClick} aria-label={hint} className={railStyles.entry}>
      <span className="relative flex">
        {icon}
        {dot && <span aria-hidden className={cn(railStyles.entryDot, dot)} />}
      </span>
      <span className={railStyles.entryLabel}>{label}</span>
    </button>
  </Tooltip>
);
