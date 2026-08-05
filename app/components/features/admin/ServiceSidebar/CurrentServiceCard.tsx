'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';

interface CurrentServiceCardProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

/**
 * The service the page is about — a full-bleed tinted band with a 2px accent
 * bar, the way a desktop rail marks the current location. It runs edge to edge
 * with the rail (no inset, no radius, no shadow) so it reads as part of the
 * chrome rather than as a card sitting on it. Still a destination like any row,
 * so it stays a button; the code shows only once a name exists, since otherwise
 * the name slot already carries it.
 */
export const CurrentServiceCard = ({ code, name, onSelect }: CurrentServiceCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn('cursor-pointer', serviceSidebarStyles.currentBand)}
  >
    <span className={cn('block', serviceSidebarStyles.currentLabel)}>현재 서비스</span>
    <span className="mt-0.5 flex items-baseline gap-1.5">
      <span className={cn('min-w-0 truncate', serviceSidebarStyles.currentName)}>
        {name || code}
      </span>
      {name && (
        <span className={cn('shrink-0', serviceSidebarStyles.currentCode)}>{code}</span>
      )}
    </span>
  </button>
);
