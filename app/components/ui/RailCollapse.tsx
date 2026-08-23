'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/ui/icons';
import { railStyles } from '@/lib/theme';

/**
 * The width at or above which the guide rail starts open.
 *
 * This is the number `GuidePanel` used to DISAPPEAR at, now doing a different job: it
 * picks a DEFAULT, and a default is something a press can overrule. Before, the viewport
 * decided whether the rail existed at all — and that rail is the only render site in the
 * app for 단계 가이드, 진행 내역 and the Jira collab channel, so below 1360
 * all three were unreachable rather than merely hidden: Tailwind's `hidden` is
 * `display:none`, which also takes them out of the accessibility tree and the tab order,
 * and no second entry point existed for any of them.
 */
export const RAIL_OPEN_MIN_WIDTH = 1360;

/**
 * `null` until the stored preference resolves. Neither the server nor the first client
 * paint can know it, so for that one frame the caller paints its media-query default —
 * which is exactly the markup the server sent.
 */
export type RailCollapsed = boolean | null;

const STORED_COLLAPSED = '1';
const STORED_EXPANDED = '0';

/**
 * Exactly two strings mean anything here. Anything else — a value written by an older
 * build, a half-finished write, a hand-edited entry — resolves to `null` and falls back
 * to the width default instead of being coerced into a boolean. A restored value that
 * skipped the invariants the gesture enforces is how a rail comes back in a state no
 * press could have produced.
 */
const readStored = (key: string): boolean | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw === STORED_COLLAPSED ? true : raw === STORED_EXPANDED ? false : null;
  } catch {
    // Private windows and blocked storage: the width default is the fallback.
    return null;
  }
};

export interface RailCollapse {
  collapsed: RailCollapsed;
  toggle: () => void;
}

/**
 * Fold state for one full-height rail, remembered across visits.
 *
 * Three-phase, the same shape `useColumnResize` uses and for the same reason: a lazy
 * initializer would have to read `localStorage` and `innerWidth` during render, and the
 * server has neither, so every rail would hydrate mismatched. Instead the first paint
 * renders `null`, the caller paints its media-query default for that frame, and the
 * stored preference lands right after mount and owns the rail from then on.
 *
 * `setTimeout(0)`, not `requestAnimationFrame` — rAF never fires in a background tab, so
 * a page opened in one would sit on the media-query default until someone looked at it.
 */
export const useRailCollapse = (
  storageKey: string,
  /** Start collapsed below this viewport width when there is no stored preference. */
  openMinWidth: number,
): RailCollapse => {
  const [collapsed, setCollapsed] = useState<RailCollapsed>(null);

  /** What the media query is painting right now — i.e. what `null` means on screen. */
  const widthDefault = useCallback(
    () => window.innerWidth < openMinWidth,
    [openMinWidth],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCollapsed(readStored(storageKey) ?? widthDefault());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey, widthDefault]);

  const toggle = useCallback(() => {
    // A press that lands before the preference resolves still has to mean "the opposite
    // of what I am looking at", and what the reader is looking at is the width default.
    const next = !(collapsed ?? widthDefault());
    setCollapsed(next);
    try {
      localStorage.setItem(storageKey, next ? STORED_COLLAPSED : STORED_EXPANDED);
    } catch {
      // Best effort — the fold still works for this visit.
    }
  }, [collapsed, storageKey, widthDefault]);

  return { collapsed, toggle };
};

interface RailToggleProps {
  /** Which way the glyph points: the direction the rail's edge MOVES when pressed. */
  direction: 'left' | 'right';
  /** What the press does — 「가이드 접기」. This is a glyph-only control, so it is its whole name. */
  label: string;
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
export const RailToggle = ({ direction, label, onClick }: RailToggleProps) => {
  const Glyph = direction === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={railStyles.toggle}
    >
      <Glyph className="h-4 w-4" />
    </button>
  );
};
