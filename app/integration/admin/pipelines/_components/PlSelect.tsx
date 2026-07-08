/**
 * PlSelect — h32 native <select> (design-inventory §5 `select.sel`).
 */
import type { ReactElement, SelectHTMLAttributes } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface PlSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** h40 variant (Figma dashboard mock) — default h32. */
  lg?: boolean;
}

export function PlSelect({ className, children, lg, ...rest }: PlSelectProps): ReactElement {
  const base = lg ? pipelineStyles.selectLg : pipelineStyles.select;
  return (
    <select className={cn(base, className)} {...rest}>
      {children}
    </select>
  );
}
