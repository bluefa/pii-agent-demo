/**
 * PlSelect — h32 native <select> (design-inventory §5 `select.sel`).
 */
import type { ReactElement, SelectHTMLAttributes } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export type PlSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function PlSelect({ className, children, ...rest }: PlSelectProps): ReactElement {
  return (
    <select className={cn(pipelineStyles.select, className)} {...rest}>
      {children}
    </select>
  );
}
