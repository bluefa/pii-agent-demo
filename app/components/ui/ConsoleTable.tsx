'use client';

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { RESIZE_LABEL_ATTR, type ColumnResize } from '@/app/components/ui/useColumnResize';
import { cn, idcStyles } from '@/lib/theme';

/** The seam zone: within this many px of a column boundary the tracer shows —
 *  the same 8px the header resize handles occupy, one grammar for "at the boundary". */
export const SEAM_ZONE_PX = 8;

/** The tracer band's width — the same 10px ramp `consoleGrid` casts at rest (round 12:
 *  the hover is that shadow deepening in place, not a new element), so the tracer's
 *  RIGHT edge must land on the seam: translateX(seam − band). */
export const SEAM_BAND_PX = 10;

/** Nearest interior column boundary within SEAM_ZONE_PX of clientX, or null. The last
 *  th's right edge is the table's outer edge, not a seam between sheets — skipped. */
export const nearestSeamX = (clientX: number, ths: ArrayLike<Element>): number | null => {
  let best: number | null = null;
  for (let i = 0; i < ths.length - 1; i += 1) {
    const edge = ths[i].getBoundingClientRect().right;
    const closer = best === null || Math.abs(edge - clientX) < Math.abs(best - clientX);
    if (Math.abs(edge - clientX) <= SEAM_ZONE_PX && closer) {
      best = edge;
    }
  }
  return best;
};

export interface ConsoleTableColumn {
  /** Stable key — `useColumnResize` stores this column's dragged width under it, so it
   *  outlives the label (which may be localized or renamed) and the column's position. */
  key: string;
  /** Header text. Doubles as the resize handle's accessible name and, through
   *  `RESIZE_LABEL_ATTR`, as the drag's own floor: a column cannot be dragged narrower
   *  than its label. */
  label: string;
  /** Default width in px, used until the user drags this column. */
  width: number;
  /** Extra header-cell classes — e.g. the leading identity column's deeper inset. */
  headClassName?: string;
}

/** One column's rendered width: the dragged width if the user set one, else the default. */
export const consoleColumnWidth = (column: ConsoleTableColumn, resize?: ColumnResize): number =>
  resize?.widthOf(column.key)?.width ?? column.width;

const ConsoleTh = ({
  column,
  resize,
}: {
  column: ConsoleTableColumn;
  resize?: ColumnResize;
}) => (
  <th
    // The handle below is a CHILD of this cell and carries its own aria-label, which the
    // accessible-name computation folds into the header's name — measured:
    // "종류" becomes "종류종류 열 너비 조절", and every cell in the column is announced
    // with that as its header. Naming the cell explicitly stops the subtree from being
    // walked. (⛔ Do not "simplify" this away as duplicating the visible label.)
    aria-label={column.label}
    className={cn(idcStyles.table.approvalHeaderCell, 'relative', column.headClassName)}
    style={{ width: consoleColumnWidth(column, resize) }}
  >
    {/* The label clips ITSELF: a bare text node in a hard-shrunk `<th>` paints over the
        neighbouring header. The attribute doubles as the hook's floor probe — drags stop
        at the width where this label would start to clip, so post-drag the ellipsis only
        ever shows for widths restored from an older storage version.
        inline-block, NOT block: the probe reads scrollWidth, and a block span's
        scrollWidth is its box (the th's width), which froze every column at its current
        width. A shrink-to-fit box reports the TEXT in both states — its own width while
        the label fits, the full text while clipped. max-w-full is what lets it clip. */}
    <span {...{ [RESIZE_LABEL_ATTR]: '' }} className="inline-block max-w-full truncate align-bottom">
      {column.label}
    </span>
    {resize && <span {...resize.handleProps(column.key, column.label)} />}
  </th>
);

interface ConsoleTableProps {
  /** Every column, in render order. A column the caller omits simply does not exist —
   *  that is how an optional column (one only some rows can fill) is expressed. */
  columns: readonly ConsoleTableColumn[];
  /** Drag-resize instance. Owned by the CALLER, not by this shell: its storage key and
   *  content cap belong to one screen's table, while this shell is shared. Omit it for
   *  a fixed-width console table. */
  resize?: ColumnResize;
  /** The `<tbody>` elements. One per row block: a tree renders parent and children as
   *  separate bodies, and `tbodySeam` keeps the hairline rhythm across them. */
  children: ReactNode;
}

/**
 * The 시안 F console table shell — scroll box, column grid, resizable header, and the
 * boundary's two states. It owns the GRAMMAR every console-style resource table shares
 * and nothing about any one table's rows: callers pass a column spec and their own
 * tbodies, and style cells with `idcStyles.table.consoleCell` so overlong values cut on
 * the boundary instead of drawing an ellipsis.
 *
 * The grammar, and why each piece is here rather than in the caller:
 * - `table-fixed` + width = Σ(columns): fixed layout is what lets a drag rule the column
 *   at all (in auto layout nowrap content dictates it and dragging changes nothing).
 *   The table's width must be the column SUM, not `w-full`: under `w-full` the fixed
 *   algorithm redistributes slack across the fixed columns, so every column silently
 *   renders wider than it declares and a 16px keyboard step moves ~3px on screen.
 * - `consoleGrid`: header rails plus, in the body, the covering sheet's cast shadow —
 *   the boundary at rest.
 * - the seam tracer: the boundary on approach. One absolutely positioned band moved
 *   imperatively to the nearest seam while the pointer is inside its zone. Imperative
 *   style writes on purpose — a mousemove-frequency setState would re-render every row.
 *
 * Frame and chrome (border, counter band, search, pagination) stay OUTSIDE: this shell
 * is the table, not the panel around it.
 */
export const ConsoleTable = ({ columns, resize, children }: ConsoleTableProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tracerRef = useRef<HTMLDivElement>(null);
  // Any width change — drag step, arrow key, double-click, reset, storage hydration —
  // douses the tracer and latches it dark until the pointer is next seen OUTSIDE a seam
  // zone; without the latch the band reappears under the parked cursor the moment a drag
  // ends. `useColumnResize` memoizes on the widths record, so the instance identity IS
  // the width signal; mount is not a width change, so the first pass only records it.
  const suppressRef = useRef(false);
  const resizeIdentityRef = useRef(resize);
  useEffect(() => {
    if (resizeIdentityRef.current === resize) return;
    resizeIdentityRef.current = resize;
    suppressRef.current = true;
    if (tracerRef.current) tracerRef.current.style.opacity = '0';
  }, [resize]);

  const handleSeamMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    const tracer = tracerRef.current;
    if (!wrap || !tracer) return;
    // Mid-gesture (a button held) the pointer is dragging a boundary or a selection — the
    // discovery band must not trail the gesture as a ghost. This also covers the drag's
    // first moves, before the width-change effect above has run.
    if (event.buttons !== 0) {
      tracer.style.opacity = '0';
      return;
    }
    const ths = wrap.querySelectorAll('thead th');
    const seamX = nearestSeamX(event.clientX, ths);
    if (seamX === null) {
      suppressRef.current = false;
      tracer.style.opacity = '0';
      return;
    }
    if (suppressRef.current) return;
    const wrapRect = wrap.getBoundingClientRect();
    // clientX-space seam → scroll-content x; the band hangs LEFT of the seam with its
    // right edge ON it, registering over the resting ramp it deepens.
    const x = seamX - wrapRect.left + wrap.scrollLeft - SEAM_BAND_PX;
    // Body only: the header keeps its line grammar (rails + the grab guide), so the band
    // starts under the thead rule instead of washing over the header labels.
    tracer.style.top = `${ths[0].getBoundingClientRect().bottom - wrapRect.top}px`;
    tracer.style.transform = `translateX(${x}px)`;
    tracer.style.opacity = '1';
  };

  const hideSeamTracer = () => {
    // Leaving the container re-arms discovery: the latch is about the residue of a
    // just-finished resize, not about a fresh visit to the table.
    suppressRef.current = false;
    if (tracerRef.current) tracerRef.current.style.opacity = '0';
  };

  return (
    <div
      ref={wrapRef}
      className="relative overflow-x-auto"
      onMouseMove={handleSeamMove}
      onMouseLeave={hideSeamTracer}
    >
      <table
        className={cn('table-fixed', idcStyles.table.consoleGrid, idcStyles.table.tbodySeam)}
        style={{
          width: columns.reduce((sum, column) => sum + consoleColumnWidth(column, resize), 0),
        }}
      >
        <thead className={idcStyles.table.approvalHeaderFlat}>
          <tr className="whitespace-nowrap">
            {columns.map((column) => (
              <ConsoleTh key={column.key} column={column} resize={resize} />
            ))}
          </tr>
        </thead>
        {children}
      </table>
      <div ref={tracerRef} data-seam-tracer="" aria-hidden className={idcStyles.table.seamTracer} />
    </div>
  );
};
