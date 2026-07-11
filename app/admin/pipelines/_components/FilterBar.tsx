/**
 * FilterBar — horizontal control row (design-inventory §5 `.filterbar`, gap 8).
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps): ReactElement {
  return <div className={cn(pipelineStyles.filterBar, className)}>{children}</div>;
}
