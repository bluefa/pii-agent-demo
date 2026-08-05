'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';

interface CurrentServiceCardProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

/**
 * The service the page is about — a real white card on the rail's canvas
 * ground (Toss grouping: surfaces separate, not hairlines), so "where am I"
 * reads at rest instead of only on hover. The eyebrow + code chip are the
 * rail's only accent use. It is a destination like any row, so it stays a
 * button; the code chip appears only once a name exists, otherwise the name
 * slot already shows the code.
 */
export const CurrentServiceCard = ({ code, name, onSelect }: CurrentServiceCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn(
      'w-full px-4 py-3 text-left cursor-pointer transition-colors',
      serviceSidebarStyles.card,
      serviceSidebarStyles.rowActive,
    )}
  >
    <span className={cn('block', serviceSidebarStyles.eyebrow)}>현재 서비스</span>
    <span className="mt-1.5 flex items-center gap-2">
      <span className={cn('min-w-0 truncate', serviceSidebarStyles.currentName)}>
        {name || code}
      </span>
      {name && (
        <span className={cn('shrink-0', serviceSidebarStyles.chipCurrent)}>{code}</span>
      )}
    </span>
  </button>
);
