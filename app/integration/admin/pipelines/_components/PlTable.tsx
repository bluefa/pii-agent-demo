/**
 * PlTable — table primitives (design-inventory §5 `.tbl`). th h34 12/600/.03em,
 * td h44 14 tabular, clickable rows (role=button, Enter/Space), and the round
 * `.chev` cell that turns primary on row hover. Wrap allows horizontal overflow
 * inside a card without shifting the page.
 *
 * Compose explicitly (columns vary per page):
 *   <PlTable head={<><PlTh>…</PlTh></>}>
 *     <PlRow onActivate={go}><PlTd>…</PlTd><PlChevCell title="…" /></PlRow>
 *   </PlTable>
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';

export interface PlTableProps {
  head: ReactNode;
  children: ReactNode;
  /** Wrap in an overflow-x-auto container (default true). */
  wrap?: boolean;
  className?: string;
}

export function PlTable({ head, children, wrap = true, className }: PlTableProps): ReactElement {
  const { table, card } = pipelineStyles;
  const node = (
    <table className={cn(table.root, className)}>
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody className={table.body}>{children}</tbody>
    </table>
  );
  return wrap ? <div className={card.tableWrap}>{node}</div> : node;
}

export interface PlThProps {
  children?: ReactNode;
  className?: string;
}

export function PlTh({ children, className }: PlThProps): ReactElement {
  return <th className={cn(pipelineStyles.table.th, className)}>{children}</th>;
}

export interface PlTdProps {
  children?: ReactNode;
  className?: string;
  /** Render content in the mono caption role (TargetSourceId, #id, …). */
  mono?: boolean;
  /** Muted weak text (timestamps). */
  muted?: boolean;
  colSpan?: number;
}

export function PlTd({ children, className, mono, muted, colSpan }: PlTdProps): ReactElement {
  const { table } = pipelineStyles;
  // Pick exactly one text role so colors never collide in the join.
  const color = mono ? table.mono : muted ? table.muted : table.tdColor;
  return (
    <td colSpan={colSpan} className={cn(table.td, color, className)}>
      {children}
    </td>
  );
}

export interface PlRowProps {
  children: ReactNode;
  /** When provided, the row becomes a keyboard-activatable button. */
  onActivate?: () => void;
  className?: string;
}

export function PlRow({ children, onActivate, className }: PlRowProps): ReactElement {
  const clickable = typeof onActivate === 'function';
  return (
    <tr
      className={cn(clickable && pipelineStyles.table.rowClickable, className)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onActivate : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
    >
      {children}
    </tr>
  );
}

export interface PlChevCellProps {
  title: string;
}

/** Right-aligned round chev button — decorative (tabindex -1); the row is the control. */
export function PlChevCell({ title }: PlChevCellProps): ReactElement {
  const { table, button } = pipelineStyles;
  return (
    <td className={table.chevCell}>
      <button
        type="button"
        tabIndex={-1}
        title={title}
        aria-hidden="true"
        className={cn(button.base, button.round, button.secondary, table.chevButton)}
      >
        <Icon name="arrow-ur" size="sm" />
      </button>
    </td>
  );
}
