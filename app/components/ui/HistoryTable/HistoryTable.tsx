'use client';

import { tableStyles, cn } from '@/lib/theme';

export interface HistoryColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (item: T) => React.ReactNode;
}

export interface HistoryTableProps<T> {
  items: T[];
  columns: HistoryColumn<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
  loading?: boolean;
}

export const HistoryTable = <T,>({
  items,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '이력이 없습니다.',
  emptyDescription,
  loading = false,
}: HistoryTableProps<T>) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-sm text-gray-400 mt-1">{emptyDescription}</p>
        )}
      </div>
    );
  }

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className={tableStyles.header}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(tableStyles.headerCell, col.width, getAlignClass(col.align))}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {items.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={cn(
                tableStyles.row,
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(tableStyles.cell, 'text-sm', getAlignClass(col.align))}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
