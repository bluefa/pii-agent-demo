/**
 * Card — white content surface (design-inventory §5 `.card`, r10 shadow-xs,
 * padding 20/24/24). `variant='stat'` = read-only grey tile (no shadow, max-w 260).
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface CardProps {
  children: ReactNode;
  variant?: 'card' | 'stat' | 'flush';
  /** Stacked below a sibling card in the same section (mt 16). */
  stacked?: boolean;
  className?: string;
}

export function Card({ children, variant = 'card', stacked, className }: CardProps): ReactElement {
  const { card } = pipelineStyles;
  const base = variant === 'stat' ? card.stat : variant === 'flush' ? card.flush : card.base;
  return <div className={cn(base, stacked && card.stack, className)}>{children}</div>;
}
