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
 * Initial tile + name + code chip on one line. The chip sits beside the name
 * (not at the far edge): with short names a right-aligned code left the row's
 * middle empty and the two columns never read as one item. Names longer than
 * the row truncate — a single-line rhythm is what makes a 15-row rail
 * scannable — and the full name stays in the row's title attribute; the code
 * is shown verbatim and case-sensitively (`/services/{code}` matches exactly).
 */
export const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left cursor-pointer transition-colors',
        serviceSidebarStyles.rowActive,
      )}
    >
      <span className={cn(serviceSidebarStyles.tile, tileClassFor(code))} aria-hidden="true">
        {(name || code).charAt(0).toUpperCase()}
      </span>
      <span className={cn('flex-1 min-w-0 truncate', serviceSidebarStyles.rowName)}>
        {name || code}
      </span>
      {name && <span className={cn('shrink-0', serviceSidebarStyles.chip)}>{code}</span>}
    </button>
  </li>
);
