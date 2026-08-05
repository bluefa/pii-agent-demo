'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';

interface ServiceRowProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
  /** The service the surrounding page is about — marked in place of a pinned band. */
  current?: boolean;
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
 * Icon tile, name, and the code in its own right-hand column — filling an equal
 * share of the list's height (`flex-1`) so a page of rows reaches the bottom of
 * the rail instead of ending halfway down it. `min-h` keeps the row readable
 * when the viewport is short enough that the list scrolls instead.
 *
 * Service names run to about 30 characters, so the name wraps — up to three
 * lines, which the stretched row has room for — rather than being cut at the
 * rail's 296px, and the code keeps a fixed column at the row's end: packed
 * against the name it would land at a different x on every row, and a long name
 * would push it off the row entirely. The full name stays in the row's title
 * attribute; the code is shown verbatim and case-sensitively (`/services/{code}`
 * matches exactly).
 */
export const ServiceRow = ({ code, name, onSelect, current = false }: ServiceRowProps) => (
  <li className="flex flex-1 min-h-[48px]">
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 text-left cursor-pointer transition-colors',
        current ? serviceSidebarStyles.rowCurrent : serviceSidebarStyles.rowActive,
      )}
    >
      <span className={cn(serviceSidebarStyles.tile, tileClassFor(code))} aria-hidden="true">
        {(name || code).charAt(0).toUpperCase()}
      </span>
      <span className={cn('flex-1 min-w-0 line-clamp-3 break-words', serviceSidebarStyles.rowName)}>
        {name || code}
      </span>
      {name && (
        <span
          className={
            current ? serviceSidebarStyles.rowCodeCurrent : serviceSidebarStyles.rowCode
          }
        >
          {code}
        </span>
      )}
    </button>
  </li>
);
