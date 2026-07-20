/**
 * TqSelectLg — the h46 r10 14/600 select (design spec §7-2 `select.sel.lg`),
 * height-matched to TqSegLg's 46px track for on-row alignment. Separate from
 * `PlSelect` (whose `lg` prop already means the h36 dashboard variant) to keep
 * that shared primitive's contract intact.
 */
import type { ReactElement, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

export type TqSelectLgProps = SelectHTMLAttributes<HTMLSelectElement>;

export function TqSelectLg({ className, children, ...rest }: TqSelectLgProps): ReactElement {
  return (
    <select className={cn(tqStyles.selectLg, className)} {...rest}>
      {children}
    </select>
  );
}
