import type { ReactNode } from 'react';

import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

interface CardActionBarProps {
  /** C-4: disabled-reason / summary copy pinned to the bar's left edge. */
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * Card bottom action zone (UX report C-2): the step-transition CTA docks at the
 * card's bottom edge, right-aligned behind a border-t, and stays visible
 * (sticky) while a long card scrolls. Mount as the LAST child of the card
 * <section> — outside the padded body — and drop `overflow-hidden` from the
 * host section, which would otherwise break position: sticky.
 */
export const CardActionBar = ({ hint, children }: CardActionBarProps) => (
  <div
    className={cn(
      'sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-b-[20px] border-t px-[28px] py-[14px]',
      borderColors.light,
      bgColors.surface,
    )}
  >
    {hint ? <p className={cn('mr-auto text-[12px]', textColors.tertiary)}>{hint}</p> : null}
    {children}
  </div>
);
