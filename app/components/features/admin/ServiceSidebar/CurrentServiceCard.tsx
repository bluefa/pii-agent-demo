'use client';

import { cn, primaryColors, textColors } from '@/lib/theme';

interface CurrentServiceCardProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

/**
 * The service the page is about, shown in the header zone as context — not as a list
 * group. The caption says what it is, so no badge is needed.
 *
 * Plain text, no container: this only answers "where am I", which nobody needs drawn to,
 * and a filled block reads as something to act on. Notion and Linear put the current
 * workspace at the top of the sidebar the same way.
 *
 * Only the name, one weight step above the rows. The code is the key you need when
 * *choosing* a row, and there is no column to line it up with here; it stays in the
 * title attribute for the exact value. It is a destination like any other row, so it
 * stays clickable and takes the same hover tint.
 */
export const CurrentServiceCard = ({ code, name, onSelect }: CurrentServiceCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn(
      'group mt-3 w-full rounded-lg px-2 py-1.5 text-left cursor-pointer transition-colors',
      primaryColors.bgLightActive,
    )}
  >
    {/* Caption lighter than the value it labels — 12px/500 against 14px/600, so size
        and weight point the same way instead of fighting. gray-500 holds 4.9:1 on the
        panel's white-ish ground and 4.3:1 on the hover tint. */}
    <span
      className={cn(
        'block text-xs font-medium',
        textColors.tertiary,
        primaryColors.groupTextOnLight,
      )}
    >
      현재 보고 있는 서비스
    </span>
    <span
      className={cn(
        'mt-1.5 block text-sm font-semibold line-clamp-2 break-words',
        textColors.primary,
        primaryColors.groupTextOnLight,
      )}
    >
      {name || code}
    </span>
  </button>
);
