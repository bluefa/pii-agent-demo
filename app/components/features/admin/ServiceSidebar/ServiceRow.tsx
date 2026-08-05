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
 * Icon tile, name, then the code trailing the name — 32px tall, the density a
 * desktop rail is read at. The code is packed against the name rather than
 * right-aligned to the rail edge: pushed to the edge it rebuilds the two-column
 * table this redesign removed, and short names leave the row's middle empty.
 * Long names truncate (single-line rhythm is what makes the rail scannable) and
 * the full name stays in the row's title attribute; the code is shown verbatim
 * and case-sensitively (`/services/{code}` matches exactly).
 */
export const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn(
        'w-full flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left cursor-pointer transition-colors',
        serviceSidebarStyles.rowActive,
      )}
    >
      <span className={cn(serviceSidebarStyles.tile, tileClassFor(code))} aria-hidden="true">
        {(name || code).charAt(0).toUpperCase()}
      </span>
      <span className={cn('min-w-0 truncate', serviceSidebarStyles.rowName)}>
        {name || code}
      </span>
      {name && <span className={cn('shrink-0', serviceSidebarStyles.rowCode)}>{code}</span>}
    </button>
  </li>
);
