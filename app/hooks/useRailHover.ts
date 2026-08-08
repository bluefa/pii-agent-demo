'use client';

import { useState } from 'react';
import { idcStyles } from '@/lib/theme';

/** One row's share of a rail. Spread the handlers; merge `className` into the row's own. */
export interface RailRowProps {
  className: string | undefined;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Tree-rail hover — for any table drawing the `idcStyles.table.group` rails.
 *
 * Hovering ANY row of a rail lights the whole rail, so the connection answers from whichever
 * end the pointer is on. The colour rides the inherited `--rail` property rather than a
 * selector: the rows of one rail are siblings, and for a group they sit in different tbodies,
 * so no CSS combinator reaches them without also catching the rows in between.
 *
 * Call once per table, then tag every row of one rail with the SAME key — the group's key for
 * a parent and its children, the cluster's row key for a cluster and its member instances:
 *
 *   const railRow = useRailHover();
 *   const rail = railRow(group.key);
 *   <tr className={cn(ROW_BASE, rail.className)} onMouseEnter={rail.onMouseEnter} … />
 */
export const useRailHover = () => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (railKey: string): RailRowProps => ({
    className: hovered === railKey ? idcStyles.table.group.railActive : undefined,
    onMouseEnter: () => setHovered(railKey),
    // Guarded so a leave arriving after the next row's enter cannot blank a rail that row
    // just lit — the two rows are separate elements and only one of them is still hovered.
    onMouseLeave: () => setHovered((current) => (current === railKey ? null : current)),
  });
};
