import { cn } from '@/lib/theme';

// v15 `.db-list-table th` (05-tables.md §1d): 14/16 pad, 13px, weight 700,
// #4E5968, letter-spacing -0.01em, NO uppercase.
export const TABLE_HEADER_CELL =
  'px-4 py-3.5 text-left text-[13px] font-bold tracking-[-0.01em] text-[#4E5968]';

// v15 `.db-list-table td` (05-tables.md §1e): 14/16 pad, text #191F28. Row
// divider (#EBEEF2) is applied by the consumer's row border.
export const TABLE_BODY_CELL = 'px-4 py-3.5 text-[#191F28]';

export const TABLE_MONO_CELL = cn(TABLE_BODY_CELL, 'font-mono text-[12px]');

// v15 `.tag` (05-tables.md §3 / idcStyles.tag): radius 8, weight 600, -0.01em.
export const TABLE_TAG_PILL =
  'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold tracking-[-0.01em]';
