/**
 * TqListTable — the Task Queue list table (prototype `.tbl`). Same composition
 * grammar as PlTable, but with the flat header (12/600 weak, no uppercase, no
 * gray-50 fill) and no zebra tint: the monitor/list prototype is flat rows with
 * gray-100 separators only. PlRow / PlTd stay reusable inside it.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

export interface TqListTableProps {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TqListTable({ head, children, className }: TqListTableProps): ReactElement {
  const { table, card } = pipelineStyles;
  return (
    <div className={card.tableWrap}>
      <table className={cn(table.root, className)}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody className={tqStyles.listTable.body}>{children}</tbody>
      </table>
    </div>
  );
}

export interface TqThProps {
  children?: ReactNode;
  className?: string;
}

export function TqTh({ children, className }: TqThProps): ReactElement {
  return <th className={cn(tqStyles.listTable.th, className)}>{children}</th>;
}
