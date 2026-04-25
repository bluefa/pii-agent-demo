import type { ReactNode } from 'react';

import { cardStyles, cn } from '@/lib/theme';

interface Props {
  busy?: boolean;
  className?: string;
  children: ReactNode;
}

export const GuideCardChrome = ({ busy, className, children }: Props) => (
  <div
    aria-busy={busy ? 'true' : undefined}
    aria-live={busy ? 'polite' : undefined}
    className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      busy && 'animate-pulse',
      cardStyles.warmVariant.container,
      className,
    )}
  >
    {children}
  </div>
);
