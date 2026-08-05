'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';

interface ServiceRowProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

/**
 * Stable tint per service: a simple code hash into the tile palette, so a
 * service keeps its color across pages and re-fetches. The tile is a scan
 * anchor, not a status — the palette carries no meaning.
 */
const tileClassFor = (code: string): string => {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash * 31 + code.charCodeAt(i)) | 0;
  const palette = serviceSidebarStyles.tilePalette;
  return palette[Math.abs(hash) % palette.length];
};

/**
 * Icon tile plus a stacked name/code cell, filling an equal share of the list's
 * height (`flex-1`) so a page of rows reaches the bottom of the rail instead of
 * ending halfway down it. `min-h` keeps the row readable when the viewport is
 * short enough that the list scrolls instead.
 *
 * The code sits under the name, not right-aligned to the rail edge: pushed to
 * the edge it rebuilds the two-column table this redesign removed, and short
 * names left the row's middle empty. Long names truncate and the full name
 * stays in the row's title attribute; the code is shown verbatim and
 * case-sensitively (`/services/{code}` matches exactly).
 */
export const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li className="flex flex-1 min-h-[52px]">
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn(
        'w-full flex items-center gap-3 px-3 text-left cursor-pointer transition-colors',
        serviceSidebarStyles.rowActive,
      )}
    >
      <span className={cn(serviceSidebarStyles.tile, tileClassFor(code))} aria-hidden="true">
        {(name || code).charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex flex-col gap-0.5">
        <span className={cn('truncate', serviceSidebarStyles.rowName)}>{name || code}</span>
        {name && <span className={serviceSidebarStyles.rowCode}>{code}</span>}
      </span>
    </button>
  </li>
);
