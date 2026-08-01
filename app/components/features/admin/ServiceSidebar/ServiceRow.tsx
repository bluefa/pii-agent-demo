'use client';

import { cn, primaryColors, textColors } from '@/lib/theme';

interface ServiceRowProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

// Tailwind v4 preflight gives buttons `cursor: default`, so clickable rows have to ask
// for the pointer explicitly — same as Pagination and Table do.
const rowLayoutClass =
  'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left cursor-pointer transition-colors';
// Service names run up to 30 characters — wrap to a second line instead of cutting
// them off at the panel's 296px. The full name stays in the row's title attribute.
const nameClass = 'flex-1 min-w-0 text-sm font-normal line-clamp-2 break-words';
// leading-5 matches the name's line box so the code sits on the first line's baseline
// even when the name wraps — the code column keeps one horizontal rhythm down the list.
const codeClass = 'shrink-0 font-mono text-xs leading-5 text-right';

/**
 * Name at the left edge where scanning starts, code right-aligned into its own column.
 *
 * Names vary in length, so an inline code lands at a different x on every row and never
 * becomes scannable; pushed right it stacks into the column the list header labels. The
 * code is shown verbatim and case-sensitively — `/services/{code}` matches exactly.
 */
export const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn('group', rowLayoutClass, primaryColors.bgLightActive)}
    >
      <span className={cn(nameClass, textColors.primary, primaryColors.groupTextOnLight)}>
        {name || code}
      </span>
      {name && (
        // tertiary, not quaternary: gray-400 sits at 2.5:1 on white, under AA for 12px.
        <span className={cn(codeClass, textColors.tertiary, primaryColors.groupTextOnLight)}>
          {code}
        </span>
      )}
    </button>
  </li>
);
